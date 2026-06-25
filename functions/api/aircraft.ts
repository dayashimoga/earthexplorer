export async function onRequest(context: any) {
  const { request } = context;
  const { searchParams } = new URL(request.url);
  const bounds = searchParams.get('bounds');

  try {
    let url = 'https://opensky-network.org/api/states/all';
    if (bounds) {
      const [lamin, lomin, lamax, lomax] = bounds.split(',');
      url += `?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ states: [], time: Date.now() / 1000 }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=15',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ states: [], time: Date.now() / 1000 }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
