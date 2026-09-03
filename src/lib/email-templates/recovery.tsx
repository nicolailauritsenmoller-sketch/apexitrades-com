import * as React from 'react'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface RecoveryEmailProps {
  siteName: string
  token?: string
}

/** Password reset is OTP-only: the email carries the 6-digit code, never a link. */
export const RecoveryEmail = ({ siteName, token }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{token ? `${token} is your ${siteName} password reset code` : `Your ${siteName} password reset code`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{siteName}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Your password reset code</Heading>
          <Text style={text}>Hello,</Text>
          <Text style={text}>
            We received a request to reset the password for your account.
          </Text>
          <Text style={text}>Your password reset code is:</Text>
          <Section style={codeBox}>
            <Text style={code}>{token || '------'}</Text>
          </Section>
          <Text style={text}>This code will expire in 10 minutes and can only be used once.</Text>
          <Text style={text}>
            Enter this code in the password reset screen on the official {siteName} platform to
            continue.
          </Text>
          <Text style={text}>
            <strong>Didn&apos;t request a password reset?</strong>
            <br />
            You can safely ignore this email. Your password will not be changed unless the
            verification process is completed.
          </Text>
          <Text style={text}>
            For your security, never share this code with anyone. Our Support Team will never ask
            you for your password, verification code, 2FA code, recovery phrase, or private key.
          </Text>
          <Text style={text}>
            If you believe someone is attempting to access your account, contact Support through
            the official platform.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>Regards,</Text>
          <Text style={footer}>Security Team</Text>
          <Text style={footer}>{siteName}</Text>
          <Text style={footer}>© {new Date().getFullYear()} {siteName}. All rights reserved.</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 16px', maxWidth: '560px' }
const header = { padding: '0 0 16px' }
const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  letterSpacing: '-0.3px',
  color: '#0052FF',
  margin: '0',
}
const card = { border: '1px solid #e6e8eb', borderRadius: '14px', padding: '28px 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0A0D12', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 18px' }
const codeBox = {
  backgroundColor: '#111111',
  borderRadius: '8px',
  padding: '12px',
  textAlign: 'center' as const,
  margin: '0 0 22px',
}
const code = {
  fontSize: '32px',
  letterSpacing: '6px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  margin: '0',
  fontFamily: 'Courier New, monospace',
}
const hr = { borderColor: '#e6e8eb', margin: '26px 0 18px' }
const footer = { fontSize: '12px', color: '#9ca3af', lineHeight: '1.6', margin: '0 0 10px' }
