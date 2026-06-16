import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "@mantine/core";
import LoginHeader from "@app/routes/login/LoginHeader";
import ErrorMessage from "@app/routes/login/ErrorMessage";
import SignupForm from "@app/routes/signup/SignupForm";
import {
  useSignupFormValidation,
  SignupFieldErrors,
} from "@app/routes/signup/SignupFormValidation";
import "@app/routes/authShared/auth.css";

interface SelfHostedSignupScreenProps {
  serverUrl: string;
  onSignup: (username: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const SelfHostedSignupScreen: React.FC<SelfHostedSignupScreenProps> = ({
  serverUrl,
  onSignup,
  loading,
  error,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({});
  const { validateSignupForm } = useSignupFormValidation();

  const displayError = error || validationError;

  const resetErrors = () => {
    setValidationError(null);
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    resetErrors();

    const validation = validateSignupForm(email, password, confirmPassword);
    if (!validation.isValid) {
      setValidationError(validation.error);
      setFieldErrors(validation.fieldErrors || {});
      return;
    }

    await onSignup(email.trim(), password);
  };

  return (
    <>
      <LoginHeader
        title={t("setup.signup.title", "Create an account")}
        subtitle={t(
          "setup.signup.subtitle",
          "Register a new account on your server",
        )}
      />

      <ErrorMessage error={displayError} />

      <Text size="sm" mb="md">
        {t("setup.login.connectingTo", "Connecting to:")}{" "}
        <Text span fw="500">
          {serverUrl}
        </Text>
      </Text>

      <SignupForm
        email={email}
        password={password}
        confirmPassword={confirmPassword}
        setEmail={(value) => {
          setEmail(value);
          resetErrors();
        }}
        setPassword={(value) => {
          setPassword(value);
          resetErrors();
        }}
        setConfirmPassword={(value) => {
          setConfirmPassword(value);
          resetErrors();
        }}
        onSubmit={handleSubmit}
        isSubmitting={loading}
        fieldErrors={fieldErrors}
        showName={false}
        showTerms={false}
      />
    </>
  );
};
