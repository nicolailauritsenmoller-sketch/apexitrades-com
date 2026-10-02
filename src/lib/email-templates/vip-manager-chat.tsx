import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  managerName?: string
  clientLabel?: string
}

const VipManagerChatEmail = ({ managerName, clientLabel = 'A VIP client' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>VIP priority chat - {clientLabel} is waiting for you</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          <Heading style={h1}>VIP priority chat</Heading>
          <Text style={text}>{managerName ? `Hello ${managerName},` : 'Hello,'}</Text>
          <Text style={text}>
            {clientLabel} has opened a priority support conversation addressed to you as their
            account manager. Sign in to the Operations Console and open Support - Live Chats to
            take over the conversation.
          </Text>
          <Text style={signOff}>Velocity Trade Operations</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VipManagerChatEmail,
  subject: 'VIP priority chat waiting',
  displayName: 'VIP manager chat alert',
  previewData: { managerName: 'Alex Morgan', clientLabel: 'Jane Doe (UID 1234567)' },
} satisfies TemplateEntry

export default VipManagerChatEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '24px 16px', maxWidth: '560px' }
const card = { border: '1px solid #e6e8eb', borderRadius: '14px', padding: '28px 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0A0D12', margin: '0 0 22px' }
const text = { fontSize: '14px', color: '#4b5563', lineHeight: '1.6', margin: '0 0 16px' }
const signOff = { fontSize: '14px', color: '#4b5563', lineHeight: '1.5', margin: '0' }
