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
    email: "KnowledgeGainzz1@gmail.com", // <-- your business email
    location: "PureGym Giltbrook, Nottingham"
  },

  social: {
    instagram: "https://www.instagram.com/knowledgegainzz", // <-- your Instagram URL
    tiktok: "https://www.tiktok.com/@knowledgegainzz"       // <-- your TikTok URL
  },

  // EmailJS (free tier: 200 emails / month).
  emailjs: {
    publicKey: "l5DKmZV-BZgsrBglV",
    serviceId: "service_slckixn",
    leoTemplateId: "template_b2bi2qf",     // email-templates/leo-notification.html
    clientTemplateId: "template_3e97gmj"   // email-templates/client-autoreply.html
  }
};
