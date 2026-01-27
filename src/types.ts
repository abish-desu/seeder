export interface VaultDbCredentials {
  username: string;
  password: string;
  lease_id: string;
  lease_duration: number;
  renewable: boolean;
}

export type DbConfig = {
  dialect: 'postgresql' | 'mysql' | 'sqlite';
  dbCredentials: {
    host: string;
    port: number;
    database: string;
    internalHost?: string;
    internalPort?: number;
    ssl?: boolean;
  };
};

export interface DatabaseConnectionData {
  host: string;
  port: number;
  database: string;
  ssl: boolean;
  internal_host: string;
  internal_port: number;
  username: string;
  password: string;
}

export type BaseDbConfig = DbConfig['dbCredentials'];
export type KVSecretData = Record<string, unknown>;


export interface Address {
  id?: string;
  country: string;
  state: string;
  city: string;
  place: string;
  street: string;
  isPermanent: boolean;
}

export interface TenantResponseData {
  id: string;
  name: string;
  address: Address;
}
export interface TenantRegistrationResponse {
  message: string;
  data: TenantResponseData;
}
