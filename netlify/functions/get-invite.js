// ================================================================
//  Netlify Serverless Function: get-invite
//  File location: netlify/functions/get-invite.js
//
//  Looks up an invite by its slug and returns the data.
//  Called automatically when a guest opens an invite link.
// ================================================================

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {

  const slug = event.queryStringParameters?.slug;

  if (!slug) {
    return { statusCode: 400, body: JSON.stringify({ message: 'No slug provided.' }) };
  }

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from('invites')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      return { statusCode: 404, body: JSON.stringify({ message: 'Invite not found.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ message: err.message }) };
  }
};