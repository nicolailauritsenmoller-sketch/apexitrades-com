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
import type { TemplateEntry } from './registry'

interface VipWelcomeProps {
  siteName?: string
  displayName?: string
  amount?: string
  tierLabel?: string
}

const VipWelcomeEmail = ({
  siteName = 'Velocity Trade',
  displayName,
  amount = '20,000 USDT',
  tierLabel = 'VIP',
}: VipWelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Welcome to VIP Status — your {amount} deposit has been confirmed.
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>{siteName}</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Welcome to VIP Status</Heading>
          <Text style={text}>{displayName ? `Hello ${displayName},` : 'Hello,'}</Text>
          <Text style={text}>
            Welcome to VIP Status — your {amount} deposit has been confirmed and your {tierLabel} perks
            are now active.
          </Text>
          <Section style={perkBox}>
            <Text style={perk}>• Zero trading fees on all markets</Text>
            <Text style={perk}>• Priority 24/7 dedicated account manager</Text>
            <Text style={perk}>• Elevated daily withdrawal limits</Text>
            <Text style={perk}>• Exclusive scalp contract return rates</Text>
          </Section>
          <Text style={text}>
            Your {tierLabel} badge is now visible on your profile, and your account manager will reach
            out through the support desk shortly.
          </Text>
          <Hr style={hr} />
          <Text style={signOff}>Regards,</Text>
          <Text style={signOff}>Client Relations</Text>
          <Text style={signOff}>{siteName}</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VipWelcomeEmail,
  subject: 'Welcome to VIP Status — your deposit is confirmed',
  displayName: 'VIP upgrade welcome',
  previewData: {
    siteName: 'Velocity Trade',
    displayName: 'Alex',
    amount: '20,000 USDT',
    tierLabel: 'VIP',
  },
} satisfies TemplateEntry

export default VipWelcomeEmail

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
const card = { border: '1px solid #e6e8eb', borderRadius: '14px', padding: '28px 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0A0D12', margin: '0 0 22px' }
const text = { fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 16px' }
const perkBox = {
  backgroundColor: '#f4f6fb',
  border: '1px solid #dbe2f0',
  borderRadius: '12px',
  padding: '18px',
  margin: '0 0 18px',
}
const perk = { fontSize: '14px', color: '#0A0D12', lineHeight: '1.6', margin: '0 0 6px' }
const hr = { borderColor: '#e6e8eb', margin: '26px 0 18px' }
const signOff = { fontSize: '14px', color: '#4b5563', lineHeight: '1.5', margin: '0' }
