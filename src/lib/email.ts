/**
 * Email utility for sending invitation emails using Resend
 */

import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

interface SendInvitationEmailParams {
  to: string;
  invitationLink: string;
  role: string;
  organizationName?: string;
}

/**
 * Send invitation email to a new user
 */
export async function sendInvitationEmail({
  to,
  invitationLink,
  role,
  organizationName = '우리 조직',
}: SendInvitationEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate environment variables
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    if (!process.env.INVITATION_EMAIL_FROM) {
      throw new Error('INVITATION_EMAIL_FROM is not configured');
    }

    // Role label in Korean
    const roleLabel = role === 'admin' ? '관리자' : role === 'doctor' ? '주치의' : '스텝';

    // Send email
    const { error } = await resend.emails.send({
      from: process.env.INVITATION_EMAIL_FROM,
      to,
      subject: `${organizationName}의 ${roleLabel}로 초대되었습니다`,
      html: `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>초대장</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 초대장이 도착했습니다!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      안녕하세요,
    </p>

    <p style="font-size: 16px; margin-bottom: 20px;">
      <strong>${organizationName}</strong>의 <strong style="color: #667eea;">${roleLabel}</strong>로 초대되었습니다.
    </p>

    <p style="font-size: 16px; margin-bottom: 30px;">
      아래 버튼을 클릭하여 계정을 생성하고 시작하세요:
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${invitationLink}"
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
        초대 수락하기
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
      또는 아래 링크를 복사하여 브라우저에 붙여넣으세요:<br>
      <a href="${invitationLink}" style="color: #667eea; word-break: break-all;">${invitationLink}</a>
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      ⏰ 이 초대장은 <strong>7일</strong> 후 만료됩니다.
    </p>

    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      이 초대를 요청하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.
    </p>
  </div>

  <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p style="font-size: 12px; color: #9ca3af;">
      이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.
    </p>
  </div>
</body>
</html>
      `,
    });

    if (error) {
      console.error('Failed to send invitation email:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
