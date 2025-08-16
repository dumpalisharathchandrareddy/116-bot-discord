// triggers.js
// Env-first (Railway), fallback to your provided IDs
const VOUCHES_CHANNEL_ID   = process.env.VOUCHES_CHANNEL_ID   || "1405983244096372839";
const GIVEAWAYS_CHANNEL_ID = process.env.GIVEAWAYS_CHANNEL_ID || "1405983236886102217";
const STAFF_ROLE_ID        = process.env.STAFF_ROLE_ID        || "1405978890970861579";

module.exports = {
  staffOnlyTriggers: {
    enjoy:
      `Glad you enjoyed! Please leave us a vouch in <#${VOUCHES_CHANNEL_ID}> and tag <@&${STAFF_ROLE_ID}>.`,
    delivered:
      `Your order has been delivered! Please leave a vouch in <#${VOUCHES_CHANNEL_ID}>.`,
    escalate:
      "We’re getting a senior staff member to help with your ticket.",
    reminder:
      `Reminder: A vouch in <#${VOUCHES_CHANNEL_ID}> helps us a lot.`,
    followup:
      "Following up! Let us know if you need anything.",
    tip:
      `A vouch in <#${VOUCHES_CHANNEL_ID}> supports us.`,
    feedback:
      `Your feedback is important! Vouch in <#${VOUCHES_CHANNEL_ID}> if satisfied.`,
    delay:
      "Sorry for the wait! We’re working on your order.",
    "good job":
      `Thanks! Please vouch in <#${VOUCHES_CHANNEL_ID}> if you’re happy.`,
  },

  dualRoleTriggers: {
    "thank you": {
      staff: "Always remember to mention in the vouch channel.",
      user:  `If you enjoyed the service, please vouch in <#${VOUCHES_CHANNEL_ID}>.`,
    },
    thanks: {
      staff: "Thanks for the support.",
      user:  `Please vouch in <#${VOUCHES_CHANNEL_ID}> if satisfied.`,
    },
    "good night": {
      staff: "Good night! Make sure tickets are updated.",
      user:  `Good night! Please vouch in <#${VOUCHES_CHANNEL_ID}> if happy.`,
    },
    bye: {
      staff: "Staff sign-off complete.",
      user:  `Thank you for using our service. Please vouch in <#${VOUCHES_CHANNEL_ID}>.`,
    },
  },

  userOnlyTriggers: {
    "good service":
      `If you enjoyed our service, vouch in <#${VOUCHES_CHANNEL_ID}> and tag <@&${STAFF_ROLE_ID}>.`,
    "fast delivery":
      "If you’re satisfied, a vouch helps us grow.",
    amazing:
      `Please vouch in <#${VOUCHES_CHANNEL_ID}> if happy.`,
    appreciate:
      `We appreciate your support! Vouch in <#${VOUCHES_CHANNEL_ID}> if satisfied.`,
    sent: "Thanks, we’ll confirm your payment shortly.",
    paid: "Payment received. Processing your order.",
    "done payment":
      "Payment noted. Processing your order.",
    "i have paid":
      "Got it. Processing your order.",
    "payment done":
      "Payment confirmed.",
    "wait a minute":
      "Sure, take your time.",
    "give me a minute":
      "Of course.",
    confirming: "We’re confirming your info.",
    checking: "Checking now.",
    "please wait": "Thank you for waiting.",
    "order placed":
      "Your order is placed.",
    "order done":
      "Order complete.",
    delivered:
      `Hope your order was great! Please vouch in <#${VOUCHES_CHANNEL_ID}> if happy.`,
    help: "If you need help, ask here or tag staff.",
    issue:
      "Please explain the issue so we can assist.",
    problem:
      "We’re here to help. Tag staff for urgent matters.",
    "any update":
      "We’re working on it.",
    "still waiting": "Checking your order status.",
    "how long":
      "Estimated wait time is about 4 minutes per ticket.",
    price: "Send your cart link for a price.",
    refund: "Explain the refund request and tag staff.",
    cancel: "Need to cancel? We can help.",
    "new order": "Send your cart link and city.",
    city: "Please mention your delivery city.",
    bye: "Thanks for choosing us.",
  },

  // Export this in case you want to reference the giveaways channel elsewhere
  GIVEAWAYS_CHANNEL_ID,
};
