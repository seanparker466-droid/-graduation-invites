// ================================================================
//  Netlify Serverless Function: create-invite
//  File location: netlify/functions/create-invite.js
//
//  What this does:
//  1. Receives the buyer's form data and photos
//  2. Uploads each photo to Cloudinary (free image hosting)
//  3. Saves all the invite data to Supabase (free database)
//  4. Returns the unique slug so the buyer gets their link
//
//  You do not need to edit this file. All secrets are stored
//  in Netlify's environment variables (explained in SETUP.md).
// ================================================================

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) };
  }

  try {
    // ---- Parse the multipart form data ----
    // Netlify passes the raw body as base64 when binary data is present
    const boundary = getBoundary(event.headers['content-type']);
    const parts    = parseMultipart(
      Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8'),
      boundary
    );

    // Extract text fields
    const fields = {};
    const photoBuffers = [];

    for (const part of parts) {
      const name = part.name;
      if (part.filename) {
        // It's a photo file
        photoBuffers.push({ buffer: part.data, filename: part.filename, mimetype: part.type });
      } else {
        fields[name] = part.data.toString('utf8');
      }
    }

    const {
      slug, firstName, lastName, highSchool, classYear,
      eventDate, startTime, endTime, location,
      rsvpPhone, rsvpEmail, rsvpMsg
    } = fields;

    // ---- Validate the slug is unique ----
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Check if this slug already exists and add suffix if so
    // Sanitize: replace anything that isn't a letter, number, or hyphen with a hyphen
    // This prevents Cloudinary's "Display name cannot contain slashes" error
    let finalSlug = slug.replace(/[^a-z0-9-]/gi, '-');
    const { data: existing } = await supabase
      .from('invites')
      .select('slug')
      .eq('slug', finalSlug)
      .single();

    if (existing) {
      // Add a short random suffix to avoid collision
      finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // ---- Upload photos to Cloudinary ----
    const photoUrls = [];

    for (let i = 0; i < photoBuffers.length; i++) {
      const photo = photoBuffers[i];
      const base64 = photo.buffer.toString('base64');
      const dataUri = `data:${photo.mimetype};base64,${base64}`;

      // Give each photo a clean, slash-free public_id so Cloudinary
      // never tries to derive a display name from the original filename
      const publicId = `${finalSlug}-photo-${i + 1}`;

      const formData = new URLSearchParams();
      formData.append('file',           dataUri);
      formData.append('upload_preset',  process.env.CLOUDINARY_PRESET);
      formData.append('public_id',      publicId);

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD}/image/upload`,
        { method: 'POST', body: formData }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error('Cloudinary Error:', errText);
        throw new Error(`Cloudinary error: ${errText}`);
      }

      const uploadData = await uploadRes.json();
      photoUrls.push(uploadData.secure_url);
    }

    // ---- Format dates for calendar links ----
    // Convert YYYY-MM-DD + HH:MM into YYYYMMDDTHHMMSS
    const toCalFormat = (date, time) =>
      `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;

    // Format date for display e.g. "Sunday, July 13, 2026"
    const displayDate = new Date(`${eventDate}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // Format time e.g. "1:00 PM – 5:00 PM"
    const fmt = t => new Date(`2000-01-01T${t}`).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });
    const displayTime = `${fmt(startTime)} – ${fmt(endTime)}`;

    // ---- Save everything to Supabase ----
    const { error } = await supabase.from('invites').insert({
      slug:          finalSlug,
      first_name:    firstName,
      last_name:     lastName,
      high_school:   highSchool,
      class_year:    classYear,
      event_date:    displayDate,
      event_time:    displayTime,
      cal_start:     toCalFormat(eventDate, startTime),
      cal_end:       toCalFormat(eventDate, endTime),
      location:      location,
      rsvp_phone:    rsvpPhone || '',
      rsvp_email:    rsvpEmail || '',
      rsvp_message:  rsvpMsg,
      hero_image:    photoUrls[0] || '',
      gallery_images: photoUrls.slice(1),
      created_at:    new Date().toISOString(),
    });

    if (error) throw new Error('Database save failed: ' + error.message);

    // ---- Return the slug so the buyer gets their link ----
    return {
      statusCode: 200,
      body: JSON.stringify({ slug: finalSlug }),
    };

  } catch (err) {
    console.error('create-invite error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: err.message || 'Something went wrong.' }),
    };
  }
};

// ================================================================
//  MULTIPART PARSER — reads the uploaded form data
//  (Netlify doesn't parse multipart forms automatically)
// ================================================================
function getBoundary(contentType) {
  const match = contentType.match(/boundary=(.+)$/);
  return match ? match[1] : '';
}

function parseMultipart(buffer, boundary) {
  const parts  = [];
  const sep    = Buffer.from(`--${boundary}`);
  const end    = Buffer.from(`--${boundary}--`);
  let   pos    = 0;

  while (pos < buffer.length) {
    const nextSep = indexOf(buffer, sep, pos);
    if (nextSep === -1) break;

    pos = nextSep + sep.length;
    if (buffer.slice(pos, pos + 2).toString() === '--') break; // end boundary

    pos += 2; // skip \r\n after boundary

    // Find end of headers
    const headerEnd = indexOf(buffer, Buffer.from('\r\n\r\n'), pos);
    if (headerEnd === -1) break;

    const headerStr = buffer.slice(pos, headerEnd).toString();
    pos = headerEnd + 4;

    // Find next boundary
    const dataEnd = indexOf(buffer, sep, pos);
    if (dataEnd === -1) break;

    const data = buffer.slice(pos, dataEnd - 2); // strip trailing \r\n

    // Parse headers
    const nameMatch     = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    const typeMatch     = headerStr.match(/Content-Type:\s*(.+)/i);

    parts.push({
      name:     nameMatch     ? nameMatch[1]     : '',
      filename: filenameMatch ? filenameMatch[1] : null,
      type:     typeMatch     ? typeMatch[1].trim() : 'text/plain',
      data,
    });

    pos = dataEnd;
  }

  return parts;
}

function indexOf(buf, search, start = 0) {
  for (let i = start; i <= buf.length - search.length; i++) {
    if (buf.slice(i, i + search.length).equals(search)) return i;
  }
  return -1;
}
