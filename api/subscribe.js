const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX, // ej: "us21"
});

module.exports = async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { email, name, provincia, tags } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email es obligatorio' });
  }

  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

  try {
    // Separar nombre en first/last
    const nameParts = (name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Agregar/actualizar contacto en Mailchimp
    const response = await mailchimp.lists.setListMember(
      audienceId,
      email.toLowerCase(),
      {
        email_address: email.toLowerCase(),
        status_if_new: 'subscribed',
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
          PROVINCIA: provincia || '',
        },
      }
    );

    // Agregar tags si vienen
    if (tags && tags.length > 0) {
      await mailchimp.lists.updateListMemberTags(
        audienceId,
        email.toLowerCase(),
        {
          tags: tags.map(tag => ({ name: tag, status: 'active' })),
        }
      );
    }

    return res.status(200).json({
      success: true,
      status: response.status,
    });
  } catch (error) {
    console.error('Mailchimp error:', error?.response?.body || error.message);
    return res.status(500).json({
      error: 'Error al suscribir',
      detail: error?.response?.body?.detail || error.message,
    });
  }
};
