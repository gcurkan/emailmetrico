const mailchimp = require('@mailchimp/mailchimp_marketing');

mailchimp.setConfig({
  apiKey: process.env.MAILCHIMP_API_KEY,
  server: process.env.MAILCHIMP_SERVER_PREFIX,
});

const buildWelcomeHTML = (firstName) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#ffffff;padding:32px 40px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <img src="https://metricoweb.com/wp-content/uploads/2025/10/Isologotipo-Color@0.5x.png" alt="MetricoWeb" width="180" style="display:block;margin:0 auto;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="color:#1f2937;font-size:24px;margin:0 0 16px 0;">
                ¡Bienvenido${firstName ? ', ' + firstName : ''}! 🎉
              </h1>
              <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px 0;">
                Tu registro en <strong>MetricoWeb</strong> fue exitoso. Ya podés acceder a nuestro catálogo completo con precios mayoristas exclusivos.
              </p>

              <!-- Descuento -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td style="background-color:#ecfdf5;border:2px solid #6ee7b7;border-radius:8px;padding:20px;text-align:center;">
                    <p style="margin:0 0 4px 0;color:#065f46;font-size:14px;">Tu descuento actual</p>
                    <p style="margin:0;color:#059669;font-size:32px;font-weight:bold;">30% OFF</p>
                    <p style="margin:4px 0 0 0;color:#065f46;font-size:13px;">Sobre todos los productos del catálogo</p>
                  </td>
                </tr>
              </table>

              <p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 28px 0;">
                Ingresá al cotizador, armá tu pedido y envialo por WhatsApp. ¡Es rápido y fácil!
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://metricoweb.com" target="_blank" style="display:inline-block;background-color:#4f46e5;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;padding:14px 36px;border-radius:8px;">
                      Ir al Cotizador
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Descuento mayor -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0 0;">
                <tr>
                  <td style="background-color:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;text-align:center;">
                    <p style="margin:0;color:#92400e;font-size:14px;">
                      🔥 <strong>¿Querés un descuento mayor?</strong><br/>
                      Contactá a nuestro equipo comercial y accedé a precios exclusivos para tu volumen.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                MetricoWeb - Distribuidora mayorista de insumos para muebles<br/>
                Este email fue enviado porque te registraste en metricoweb.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

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

    // 1. Agregar/actualizar contacto en Mailchimp
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

    // 2. Agregar tags si vienen
    if (tags && tags.length > 0) {
      await mailchimp.lists.updateListMemberTags(
        audienceId,
        email.toLowerCase(),
        {
          tags: tags.map(tag => ({ name: tag, status: 'active' })),
        }
      );
    }

    // 3. Enviar email de bienvenida via campaign
    try {
      // Crear campaña
      const campaign = await mailchimp.campaigns.create({
        type: 'regular',
        recipients: {
          list_id: audienceId,
          segment_opts: {
            match: 'all',
            conditions: [{
              condition_type: 'EmailAddress',
              field: 'EMAIL',
              op: 'is',
              value: email.toLowerCase(),
            }],
          },
        },
        settings: {
          subject_line: `¡Bienvenido a MetricoWeb, ${firstName || 'nuevo usuario'}! Tu cuenta está lista`,
          from_name: 'MetricoWeb',
          reply_to: 'info@metricoweb.com',
        },
      });

      // Setear contenido HTML
      await mailchimp.campaigns.setContent(campaign.id, {
        html: buildWelcomeHTML(firstName),
      });

      // Enviar
      await mailchimp.campaigns.send(campaign.id);
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError?.response?.body || emailError.message);
      // No falla el subscribe si el email falla
    }

    return res.status(200).json({
      success: true,
      status: response.status,
      emailSent: true,
    });
  } catch (error) {
    console.error('Mailchimp error:', error?.response?.body || error.message);
    return res.status(500).json({
      error: 'Error al suscribir',
      detail: error?.response?.body?.detail || error.message,
    });
  }
};
