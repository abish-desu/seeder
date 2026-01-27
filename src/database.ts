import { Pool } from 'pg';
import { VaultClient } from './vault-client';
import { BaseDbConfig, VaultDbCredentials } from './types';

export class VaultPostgresManager {
  private pool?: Pool;
  private credentials?: VaultDbCredentials;
  private renewalTimer?: NodeJS.Timeout;

  constructor(
    private vaultClient: VaultClient,
    private tenantName: string
  ) { }

  async connect(useInternal: boolean = false): Promise<void> {
    this.credentials = await this.vaultClient.getDbCredentials(this.tenantName);
    const baseConfig = await this.vaultClient.getRootDbConfig()

    const host = useInternal && baseConfig?.internalHost
      ? baseConfig.internalHost
      : baseConfig?.host;

    const port = useInternal && baseConfig?.internalPort
      ? baseConfig.internalPort
      : baseConfig?.port;

    // add _db to tenant name
    const databaseName = `${this.tenantName}_db`;
    console.log(databaseName)
    this.pool = new Pool({
      host,
      port,
      database: databaseName,
      user: this.credentials?.username,
      password: this.credentials.password,
      ssl: baseConfig?.ssl ? { rejectUnauthorized: false } : undefined,
      max: 20,
      idleTimeoutMillis: 30000,
    });

    const client = await this.pool.connect();
    console.log('✓ Connected to PostgreSQL');
    client.release();

    if (this.credentials.renewable) {
      this.setupLeaseRenewal();
    }
  }

  private setupLeaseRenewal(): void {
    if (!this.credentials) return;
    const renewalInterval = (this.credentials.lease_duration - 300) * 1000;

    this.renewalTimer = setInterval(async () => {
      if (this.credentials) {
        await this.vaultClient.renewLease(this.credentials.lease_id);
        console.log('✓ Lease renewed');
      }
    }, renewalInterval);
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (!this.pool) throw new Error('Not connected');
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async close(): Promise<void> {
    if (this.renewalTimer) clearInterval(this.renewalTimer);
    if (this.pool) await this.pool.end();
    if (this.credentials) {
      await this.vaultClient.revokeLease(this.credentials.lease_id);
    }
  }
}