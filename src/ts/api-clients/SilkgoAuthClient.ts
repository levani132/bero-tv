import { AbstractClient } from "./AbstractClient";
import { ApiTokenResponse } from "../models/api-models";
import { GUEST_CLIENT_ID, SILKGO_API, USER_CLIENT_ID } from "../models/config";

// Mints/refreshes the platform token used to authorize Tvibo calls.
// Guest mint is VERIFIED (2026-06-21). See contracts/silkgo-auth.md.
export class SilkgoAuthClient extends AbstractClient {
  // Guest token: grant_type=client_implicit (NOT silk_implicit — that's user OTP login).
  mintGuestToken(): Promise<ApiTokenResponse> {
    return this.post<ApiTokenResponse>(
      SILKGO_API + "/auth/token",
      { grant_type: "client_implicit", client_id: GUEST_CLIENT_ID },
      { "Content-Type": "application/json", "X-APP-GUEST": "true", "Accept-Language": "ka" }
    );
  }

  refresh(refreshToken: string): Promise<ApiTokenResponse> {
    return this.post<ApiTokenResponse>(
      SILKGO_API + "/auth/token",
      { grant_type: "refresh_token", refresh_token: refreshToken, client_id: USER_CLIENT_ID },
      { "Content-Type": "application/json" }
    );
  }
}

export const silkgoAuth = new SilkgoAuthClient();
