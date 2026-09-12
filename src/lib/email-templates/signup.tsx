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

interface SignupEmailProps {
  siteName: string
  token: string
}

export const SignupEmail = ({
  siteName,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {token ? `Your ${siteName} verification code is ${token}` : `Verify your email address for ${siteName}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{siteName}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Verify your email address</Heading>
          <Text style={text}>Hello,</Text>
          <Text style={text}>
            Welcome to {siteName}.
          </Text>
          <Text style={text}>
            To complete your account registration, please enter the verification code below:
          </Text>
          {token ? (
            <Section style={codeBox}>
              <Text style={code}>{token}</Text>
            </Section>
          ) : null}
          <Text style={text}>
            This code will expire in 10 minutes and can only be used once.
          </Text>
          <Text style={text}>
            Enter this code in the verification screen on the official {siteName} website or application to verify your email address.
          </Text>
          <Hr style={hr} />
          <Text style={text}>
            Didn&apos;t create this account?
          </Text>
          <Text style={text}>
            You can safely ignore this email. No action is required.
          </Text>
          <Text style={security}>
            For your security, never share this code with anyone. Our Support Team will never ask you for your password, verification code, 2FA code, recovery phrase, or private key.
          </Text>
          <Text style={signOff}>Regards,</Text>
          <Text style={signOff}>Security Team</Text>
          <Text style={signOff}>{siteName}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 16px', maxWidth: '560px' }
const header = { padding: '0 0 16px' }
const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  letterSpacing: '-0.3px',
  color: '#FCD535',
  margin: '0',
}
const card = {
  border: '1px solid #e6e8eb',
  borderRadius: '14px',
  padding: '28px 24px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#0A0D12',
  margin: '0 0 22px',
}
const text = { fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 16px' }
const codeBox = {
  backgroundColor: '#f4f6fb',
  border: '1px solid #dbe2f0',
  borderRadius: '12px',
  padding: '22px 18px',
  textAlign: 'center' as const,
  margin: '22px 0 22px',
}
const code = {
  fontSize: '36px',
  letterSpacing: '12px',
  fontWeight: 'bold' as const,
  color: '#0A0D12',
  margin: '0',
  fontFamily: 'Courier New, monospace',
}
const hr = { borderColor: '#e6e8eb', margin: '26px 0 18px' }
const security = {
  fontSize: '13px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 16px',
  fontWeight: 'bold' as const,
}
const signOff = {
  fontSize: '14px',
  color: '#4b5563',
  lineHeight: '1.5',
  margin: '0',
}
