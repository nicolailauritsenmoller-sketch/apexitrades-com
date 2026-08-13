import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {token ? `${token} is your ${siteName} verification code` : `Confirm your email for ${siteName}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{siteName}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Verify your email</Heading>
          <Text style={text}>
            Welcome to {siteName}. Use the verification code below to finish creating your
            account for <strong style={strong}>{recipient}</strong>.
          </Text>
          {token ? (
            <Section style={codeBox}>
              <Text style={code}>{token}</Text>
              <Text style={codeHint}>This code expires in 60 minutes.</Text>
            </Section>
          ) : null}
          {confirmationUrl ? (
            <Button style={button} href={confirmationUrl}>
              Verify Email
            </Button>
          ) : null}
          <Hr style={hr} />
          <Text style={footer}>
            If you didn&apos;t create a {siteName} account, you can safely ignore this email.
            We will never ask you for your password, verification code, or recovery phrase.
          </Text>
          <Text style={footer}>
            Support: <Link href={`${siteUrl}/support`} style={link}>{siteUrl}/support</Link>
            <br />© {new Date().getFullYear()} {siteName}. All rights reserved.
          </Text>
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
  color: '#0052FF',
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
  margin: '0 0 16px',
}
const text = { fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 22px' }
const strong = { color: '#0A0D12' }
const codeBox = {
  backgroundColor: '#f4f6fb',
  border: '1px solid #dbe2f0',
  borderRadius: '12px',
  padding: '18px',
  textAlign: 'center' as const,
  margin: '0 0 22px',
}
const code = {
  fontSize: '32px',
  letterSpacing: '10px',
  fontWeight: 'bold' as const,
  color: '#0A0D12',
  margin: '0',
  fontFamily: 'Courier New, monospace',
}
const codeHint = { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }
const button = {
  backgroundColor: '#0052FF',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '12px 22px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e6e8eb', margin: '26px 0 18px' }
const link = { color: '#0052FF', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#9ca3af', lineHeight: '1.6', margin: '0 0 10px' }
