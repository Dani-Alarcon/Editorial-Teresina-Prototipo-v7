// Datos para el pago por transferencia bancaria.
// Se configuran en Vercel (Settings → Environment Variables), nunca en el código:
//   BANK_IBAN      IBAN de la cuenta de la editorial (obligatorio para que se muestre el bloque).
//   BANK_TITULAR   titular de la cuenta (por defecto: Editorial Teresina SCP).
//   BANK_BIC       opcional.
module.exports = (req, res) => {
  const iban = (process.env.BANK_IBAN || '').trim();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (!iban) return res.status(200).end(JSON.stringify({ iban: null }));
  res.status(200).end(JSON.stringify({
    iban: iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim(),
    titular: (process.env.BANK_TITULAR || 'Editorial Teresina SCP').trim(),
    bic: (process.env.BANK_BIC || '').trim() || null,
    email: 'pedidoseditorialteresina@gmail.com'
  }));
};
