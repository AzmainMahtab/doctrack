export interface CurrentUser {
  id: string;
  role: string;
  permissions: readonly string[];
  sessionId: string;
  tokenId: string;
  expiresAt: Date;
}
