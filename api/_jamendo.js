const CLIENT_ID = process.env.JAMENDO_CLIENT_ID;

exports.get = async params => {
  if (!CLIENT_ID) throw new Error('JAMENDO_CLIENT_ID is not configured');
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('format', 'json');
  url.searchParams.set('audioformat', 'mp32');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url);
  if (!response.ok) throw new Error('Jamendo ' + response.status);
  const data = await response.json();
  if (data.headers && data.headers.status !== 'success')
    throw new Error(data.headers.error_message || 'Jamendo request failed');
  return data.results || [];
};
