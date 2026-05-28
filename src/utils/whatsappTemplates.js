// ==========================================
// FreelanceOS — WhatsApp Message Templates
// ==========================================

export const whatsappTemplates = {
  'Project Proposal Follow-up': (client, project, value) =>
`Hi ${client.name},

Hope you're doing well! 🙏

I wanted to follow up on the proposal I shared for *${project || client.projectName}*${value ? ` (₹${value})` : ''}. 

I'd love to discuss any questions you might have and understand if there are any changes you'd like me to make to the scope or timeline.

Would you have 15 minutes this week for a quick call? Happy to connect at your convenience.

Looking forward to hearing from you!

Best regards`,

  'Payment Reminder (Friendly)': (client, project, value) =>
`Hi ${client.name},

Hope everything is going great! 😊

Just a gentle reminder about the pending payment for *${project || client.projectName}*${value ? ` — ₹${value}` : ''}. 

I understand things get busy, so just wanted to bring this to your notice. Please let me know if you need any clarification regarding the invoice or if there's a preferred payment date.

Thank you so much! 🙏

Best regards`,

  'Payment Reminder (Firm)': (client, project, value) =>
`Hi ${client.name},

I hope you're well.

I'm writing to follow up regarding the outstanding payment for *${project || client.projectName}*${value ? ` — ₹${value}` : ''}, which is now past the due date.

As per our agreement, payment was expected within 15 days of the invoice date. I would really appreciate it if you could process this at the earliest.

If there's any issue or if you need the invoice resent, please do let me know and I'll sort it out right away.

Looking forward to your response.

Thank you,
Best regards`,

  'Project Update': (client, project) =>
`Hi ${client.name},

Quick update on *${project || client.projectName}*! 🚀

Here's what we've accomplished:
• [Update 1]
• [Update 2]
• [Update 3]

*Next steps:*
• [Next milestone]
• [Expected completion]

Everything is on track and progressing well. Please feel free to share any feedback or let me know if you'd like to discuss anything.

Best regards`,

  'Thank You after Payment': (client, project, value) =>
`Hi ${client.name},

Thank you so much for the payment${value ? ` of ₹${value}` : ''} for *${project || client.projectName}*! 🙏💚

It was a pleasure working with you on this project. I'm glad we could deliver great results together.

If you need any future help or have upcoming projects, I'd be happy to assist. Also, if you know anyone who might benefit from similar services, a referral would mean a lot! 😊

Wishing you and *${client.company}* continued success!

Warm regards`,

  'Milestone Completed': (client, project) =>
`Hi ${client.name},

Great news! 🎉

We've completed a key milestone on *${project || client.projectName}*:

*Milestone:* [Milestone Name]
*Deliverables:* [What was delivered]

Please take a moment to review and share your feedback. Once approved, we'll move on to the next phase.

If you'd like any changes, just let me know — happy to iterate!

Best regards`,

  'Project Kickoff': (client, project) =>
`Hi ${client.name},

Excited to kick off *${project || client.projectName}*! 🚀

Here's what to expect:

*Timeline:* [X days/weeks]
*First Deliverable:* [What they'll see first]
*Communication:* I'll share weekly updates here on WhatsApp

To get started, I'll need:
• [Requirement 1]
• [Requirement 2]
• [Any access/credentials needed]

Please share these at your convenience and we'll get rolling!

Looking forward to a great collaboration! 🤝

Best regards`,
};

export const templateTypes = [
  'Project Proposal Follow-up',
  'Payment Reminder (Friendly)',
  'Payment Reminder (Firm)',
  'Project Update',
  'Thank You after Payment',
  'Milestone Completed',
  'Project Kickoff',
];
