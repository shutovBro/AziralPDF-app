import { springAuth } from "@app/auth/springAuthClient";
import { BASE_PATH } from "@app/constants/app";

export const useAuthService = () => {
  const signUp = async (username: string, email: string, password: string) => {
    console.log("[Signup] Creating account:", username);

    const { user, session, error } = await springAuth.signUp({
      username: username.trim(),
      email: email.trim(),
      password: password,
      options: {
        emailRedirectTo: `${BASE_PATH}/auth/callback`,
      },
    });

    if (error) {
      console.error("[Signup] Sign up error:", error);
      throw new Error(error.message);
    }

    if (user) {
      console.log("[Signup] Sign up successful:", user);
      return {
        user: user,
        session: session,
        requiresEmailConfirmation: user && !session,
      };
    }

    throw new Error("Unknown error occurred during signup");
  };

  const signInWithProvider = async (
    provider: "github" | "google" | "apple" | "azure",
  ) => {
    const { error } = await springAuth.signInWithOAuth({
      provider,
      options: { redirectTo: `${BASE_PATH}/auth/callback` },
    });

    if (error) {
      throw new Error(error.message);
    }
  };

  return {
    signUp,
    signInWithProvider,
  };
};
