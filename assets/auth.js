// This is for when you set up a proper backend
export default async function handler(request, response) {
  if (request.method === 'POST') {
    const { code } = request.body;
    
    const data = {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.REDIRECT_URI,
    };

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        body: new URLSearchParams(data),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const tokens = await tokenResponse.json();
      
      if (tokens.access_token) {
        const userResponse = await fetch('https://discord.com/api/users/@me', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });
        
        const userData = await userResponse.json();
        response.status(200).json(userData);
      } else {
        response.status(400).json({ error: 'Invalid code' });
      }
    } catch (error) {
      response.status(500).json({ error: 'Internal server error' });
    }
  } else {
    response.status(405).json({ error: 'Method not allowed' });
  }
}
