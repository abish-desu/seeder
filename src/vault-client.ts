import nodeVault from 'node-vault';
import { BaseDbConfig, DatabaseConnectionData, KVSecretData, VaultDbCredentials } from './types';

export class VaultClient {
  private client: ReturnType<typeof nodeVault>;;

  constructor(vaultAddress: string, vaultToken: string) {
    this.client = nodeVault({
      apiVersion: 'v1',
      endpoint: vaultAddress,
      token: vaultToken,
    });
  }

  async getDbCredentials(tenantName: string): Promise<VaultDbCredentials> {
    try {
      const roleName = `${tenantName}-role`;
      const response = await this.client.read(`database/creds/${roleName}`);

      return {
        username: response.data.username,
        password: response.data.password,
        lease_id: response.lease_id,
        lease_duration: response.lease_duration,
        renewable: response.renewable,
      };
    } catch (error) {
      console.error('Failed to get credentials from Vault:', error);
      throw error;
    }
  }

  async getRootDbConfig(): Promise<BaseDbConfig | undefined> {
    try {
      // Try to get from KV first
      const kvConfig = await this.getDatabaseConnectionInfo();
      if (kvConfig) {
        return {
          host: kvConfig.host,
          internalHost: kvConfig.internal_host,
          internalPort: kvConfig.internal_port,
          port: kvConfig.port,
          database: kvConfig.database,
          ssl: kvConfig.ssl,
        };
      }
    } catch (error) {
      throw error;
    }

    return;
  }

  async getDatabaseConnectionInfo(): Promise<DatabaseConnectionData | null> {
    const data = await this.getKVSecret('app/database');
    if (!data) return null;

    // Validate that we have all required properties for DatabaseConnectionData
    const requiredFields: (keyof DatabaseConnectionData)[] = [
      'host',
      'port',
      'database',
      'ssl',
      'internal_host',
      'internal_port',
    ];

    for (const field of requiredFields) {
      if (!(field in data)) {
        return null;
      }
    }

    return data as unknown as DatabaseConnectionData;
  }

  async getKVSecret(path: string): Promise<KVSecretData | null> {
    try {
      const response = await this.client.read(`secret/data/${path}`);

      if (response.data?.data) {
        return response.data.data as KVSecretData;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  async renewLease(leaseId: string, increment?: number): Promise<void> {
    await this.client.write('sys/leases/renew', {
      lease_id: leaseId,
      increment: increment || 3600,
    });
  }

  async revokeLease(leaseId: string): Promise<void> {
    await this.client.write('sys/leases/revoke', {
      lease_id: leaseId,
    });
  }
}