/*
 * KnowledgeGainzz — site configuration
 * ------------------------------------
 * Edit the values below. Nothing else in the site needs changing
 * to update your email, socials or email automation keys.
 * See README.md for step-by-step EmailJS setup.
 */
window.KG_CONFIG = {
  business: {
    name: "KnowledgeGainzz",
    trainer: "Leo",
    email: "hello@knowledgegainzz.co.uk", // <-- your business email
    location: "PureGym Giltbrook, Nottingham"
  },

  social: {
    instagram: "https://www.instagram.com/knowledgegainzz", // <-- your Instagram URL
    tiktok: "https://www.tiktok.com/@knowledgegainzz"       // <-- your TikTok URL
  },

  // EmailJS (free tier: 200 emails / month). Leave as-is until set up —
  // the form falls back to opening the client's email app instead.
  emailjs: {
    publicKey: "YOUR_PUBLIC_KEY",
    serviceId: "YOUR_SERVICE_ID",
    leoTemplateId: "YOUR_LEO_TEMPLATE_ID",       // email-templates/leo-notification.html
    clientTemplateId: "YOUR_CLIENT_TEMPLATE_ID"  // email-templates/client-autoreply.html
  }
};
