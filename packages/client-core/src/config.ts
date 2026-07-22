export interface ClientConfig {
  baseUrl: string;
  onUnauthorized?: () => void;
  refreshAccessToken?: () => Promise<string | null>;
}

let config: ClientConfig = { baseUrl: "" };
let tokenAccessor: () => string | null = () => null;

export function configureClient(next: ClientConfig): void {
  config = next;
}

export function getClientConfig(): ClientConfig {
  return { ...config };
}

export function setTokenAccessor(fn: () => string | null): void {
  tokenAccessor = fn;
}

export function getToken(): string | null {
  return tokenAccessor();
}
