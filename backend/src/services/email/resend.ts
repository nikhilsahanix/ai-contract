import { Resend } from "resend";
import { env } from "../../config/env.js";

const resend = new Resend(env.RESEND_API_KEY);

// ─── SHARED STYLES ─────────────────────────────────────────────────────────
// Using inline styles is required for maximum compatibility across email clients.
const theme = {
  bg: "#0a0a0a",
  card: "#111111",
  border: "#222222",
  textMain: "#ffffff",
  textMuted: "#888888",
  gold: "#B8952A",
  goldHover: "#a68626",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const baseTemplate = (title: string, content: string, ctaButton: string) => `
  <div style="background-color: ${theme.bg}; color: ${theme.textMain}; font-family: ${theme.fontFamily}; padding: 40px 20px; margin: 0; min-height: 100vh; width: 100%;">
    <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: ${theme.card}; border: 1px solid ${theme.border}; border-radius: 12px; overflow: hidden;">
      
      <!-- Header -->
      <tr>
        <td style="padding: 30px 40px; border-bottom: 1px solid ${theme.border}; text-align: center;">
          <span style="color: ${theme.gold}; font-size: 20px; font-weight: 800; letter-spacing: 4px;">CONTRACTIQ</span>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding: 40px;">
          <h1 style="margin: 0 0 20px 0; font-size: 24px; font-weight: bold; color: ${theme.textMain};">${title}</h1>
          ${content}
          ${ctaButton}
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding: 30px 40px; border-top: 1px solid ${theme.border}; background-color: #0d0d0d; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: ${theme.textMuted}; line-height: 1.5;">
            ContractIQ Inc.<br>
            Secure AI Contract Analysis for Modern Law Firms<br>
            <br>
            If you did not request this email, you can safely ignore it.
          </p>
        </td>
      </tr>
      
    </table>
  </div>
`;

// ─── EMAIL FUNCTIONS ───────────────────────────────────────────────────────

export async function sendVerificationEmail(email: string, token: string) {
  // CRITICAL: Pointing to the FRONTEND to trigger the auto-login UI!
  const verifyLink = `${env.FRONTEND_URL}/verify-email?token=${token}`;

  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #cccccc;">
      Welcome to ContractIQ. We're thrilled to have your firm on board. 
      To ensure the security of your isolated workspace, please verify your email address.
    </p>
  `;

  const button = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 10px;">
      <tr>
        <td align="center">
          <a href="${verifyLink}" style="display: inline-block; background-color: ${theme.gold}; color: #000000; font-weight: bold; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 8px; transition: background-color 0.2s;">
            Verify Email & Login
          </a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 24px;">
          <p style="margin: 0; font-size: 12px; color: ${theme.textMuted}; word-break: break-all;">
            Or copy and paste this link into your browser:<br>
            <a href="${verifyLink}" style="color: ${theme.gold}; text-decoration: none;">${verifyLink}</a>
          </p>
        </td>
      </tr>
    </table>
  `;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Verify your ContractIQ workspace",
    html: baseTemplate("Activate your workspace", content, button)
  });
}

export async function sendAnalysisCompletedEmail(email: string, contractId: string) {
  const viewLink = `${env.FRONTEND_URL}/contracts/${contractId}`;

  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #cccccc;">
      Good news. Our AI engine has successfully completed the risk analysis and generated redlines for your recently uploaded contract.
    </p>
    <div style="background-color: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 8px; padding: 16px; margin-bottom: 30px;">
      <p style="margin: 0; color: #4ade80; font-size: 14px; font-weight: bold;">✓ Analysis Complete & Ready for Review</p>
    </div>
  `;

  const button = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="left">
          <a href="${viewLink}" style="display: inline-block; background-color: #1a1a1a; border: 1px solid ${theme.gold}; color: ${theme.textMain}; font-weight: bold; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
            View Redlines & Report
          </a>
        </td>
      </tr>
    </table>
  `;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Contract analysis completed",
    html: baseTemplate("Analysis Complete", content, button)
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}`;

  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #cccccc;">
      We received a request to reset the password for your ContractIQ account.
      This link expires in 1 hour.
    </p>
    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: ${theme.textMuted};">
      If you did not request a password reset, you can safely ignore this email — your password will not change.
    </p>
  `;

  const button = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="left">
          <a href="${resetLink}" style="display: inline-block; background-color: ${theme.gold}; color: #000000; font-weight: bold; font-size: 16px; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
            Reset Password
          </a>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 20px;">
          <p style="margin: 0; font-size: 12px; color: ${theme.textMuted}; word-break: break-all;">
            Or copy: <a href="${resetLink}" style="color: ${theme.gold};">${resetLink}</a>
          </p>
        </td>
      </tr>
    </table>
  `;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Reset your ContractIQ password",
    html: baseTemplate("Password Reset Request", content, button),
  });
}

export async function sendAnalysisFailedEmail(email: string, contractId: string) {
  const dashboardLink = `${env.FRONTEND_URL}/dashboard`;

  const content = `
    <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #cccccc;">
      We encountered an unexpected error while our AI engine was processing your contract. This usually happens if the document is encrypted, corrupted, or contains unreadable scanned images.
    </p>
    <div style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 16px; margin-bottom: 30px;">
      <p style="margin: 0; color: #f87171; font-size: 14px; font-weight: bold;">⚠ Analysis Failed</p>
    </div>
    <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: ${theme.textMuted};">
      Your analysis quota has <b>not</b> been deducted for this attempt. Please try re-uploading a clean PDF or DOCX file.
    </p>
  `;

  const button = `
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="left">
          <a href="${dashboardLink}" style="display: inline-block; background-color: #1a1a1a; border: 1px solid #444; color: ${theme.textMain}; font-weight: bold; font-size: 15px; text-decoration: none; padding: 12px 28px; border-radius: 8px;">
            Return to Dashboard
          </a>
        </td>
      </tr>
    </table>
  `;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: email,
    subject: "Action Required: Contract analysis failed",
    html: baseTemplate("Processing Error", content, button)
  });
}