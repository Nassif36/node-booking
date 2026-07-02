const config = window.BOOKING_APP_CONFIG || { API_BASE_URL: '/api/v1' };
const state = {
  accessToken: localStorage.getItem('booking_access_token') || '',
  refreshToken: localStorage.getItem('booking_refresh_token') || '',
  user: JSON.parse(localStorage.getItem('booking_user') || 'null'),
};

const el = {
  status: document.getElementById('status'),
  authUser: document.getElementById('authUser'),
  results: document.getElementById('results'),
  propertyDetails: document.getElementById('propertyDetails'),
  propertyId: document.getElementById('propertyId'),
  bookingCheckIn: document.getElementById('bookingCheckIn'),
  bookingCheckOut: document.getElementById('bookingCheckOut'),
  bookingGuests: document.getElementById('bookingGuests'),
  specialRequests: document.getElementById('specialRequests'),
};

function setStatus(payload) {
  el.status.textContent =
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

function syncAuthUi() {
  if (!state.user) {
    el.authUser.textContent = 'Not authenticated';
    return;
  }
  el.authUser.textContent = `Authenticated as ${state.user.firstName} ${state.user.lastName} (${state.user.role})`;
}

function persistAuth() {
  if (state.accessToken) {
    localStorage.setItem('booking_access_token', state.accessToken);
    localStorage.setItem('booking_refresh_token', state.refreshToken || '');
    localStorage.setItem('booking_user', JSON.stringify(state.user || null));
  } else {
    localStorage.removeItem('booking_access_token');
    localStorage.removeItem('booking_refresh_token');
    localStorage.removeItem('booking_user');
  }
  syncAuthUi();
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (state.accessToken) {
    headers.Authorization = 'Bearer ' + state.accessToken;
  }

  const response = await fetch(`${config.API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw json;
  }
  return json?.data;
}

function authPayloadFromForm(prefix) {
  return {
    email: document.getElementById(`${prefix}Email`).value.trim(),
    password: document.getElementById(`${prefix}Password`).value,
  };
}

function bookingPayload() {
  return {
    propertyId: el.propertyId.value.trim(),
    checkIn: el.bookingCheckIn.value,
    checkOut: el.bookingCheckOut.value,
    guests: Number(el.bookingGuests.value),
    specialRequests: el.specialRequests.value.trim() || undefined,
  };
}

function mapError(error) {
  return {
    statusCode: error.statusCode || 'UNKNOWN',
    message: error.message || 'Request failed',
    errors: error.errors || [],
  };
}

function renderProperties(items) {
  if (!items.length) {
    el.results.innerHTML = '<p class="muted">No properties found.</p>';
    return;
  }

  el.results.innerHTML = '';
  for (const property of items) {
    const card = document.createElement('article');
    card.className = 'result-item';

    const primaryImage = property.images?.[0]?.url || '';

    card.innerHTML = `
      <h3>${property.title}</h3>
      <p class="muted">${property.city}, ${property.province}</p>
      <p>${property.description || ''}</p>
      <p><strong>Base price:</strong> ARS ${property.basePrice}</p>
      <p><strong>Max guests:</strong> ${property.maxGuests}</p>
      ${primaryImage ? `<p class="muted">Image: ${primaryImage}</p>` : ''}
      <div class="inline-actions">
        <button class="select-btn">Select</button>
        <button class="detail-btn secondary">Details</button>
      </div>
    `;

    card.querySelector('.select-btn').addEventListener('click', () => {
      selectProperty(property);
      setStatus({ message: 'Property selected', propertyId: property.id });
    });

    card.querySelector('.detail-btn').addEventListener('click', async () => {
      try {
        const details = await request(`/properties/${property.id}`);
        selectProperty(details);
        setStatus({ message: 'Loaded property details', details });
      } catch (error) {
        setStatus(mapError(error));
      }
    });

    el.results.appendChild(card);
  }
}

function selectProperty(property) {
  el.propertyId.value = property.id;
  const checkIn = document.getElementById('checkIn').value;
  const checkOut = document.getElementById('checkOut').value;
  if (checkIn) el.bookingCheckIn.value = checkIn;
  if (checkOut) el.bookingCheckOut.value = checkOut;
  el.bookingGuests.value = document.getElementById('guests').value || '2';
  el.propertyDetails.textContent = JSON.stringify(
    {
      id: property.id,
      title: property.title,
      city: property.city,
      province: property.province,
      maxGuests: property.maxGuests,
      basePrice: property.basePrice,
      owner: property.owner,
    },
    null,
    2,
  );
}

document.getElementById('registerBtn').addEventListener('click', async () => {
  try {
    const body = {
      ...authPayloadFromForm('reg'),
      firstName: document.getElementById('regFirstName').value.trim(),
      lastName: document.getElementById('regLastName').value.trim(),
    };
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    persistAuth();
    setStatus({ message: 'Registered and authenticated', user: data.user });
  } catch (error) {
    setStatus(mapError(error));
  }
});

document.getElementById('loginBtn').addEventListener('click', async () => {
  try {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(authPayloadFromForm('login')),
    });
    state.accessToken = data.accessToken;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    persistAuth();
    setStatus({ message: 'Logged in', user: data.user });
  } catch (error) {
    setStatus(mapError(error));
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  if (!state.refreshToken) {
    state.accessToken = '';
    state.user = null;
    persistAuth();
    setStatus('Logged out locally.');
    return;
  }

  try {
    await request('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: state.refreshToken }),
    });
  } catch (error) {
    setStatus({ warning: 'Logout API failed, clearing local session', error: mapError(error) });
  } finally {
    state.accessToken = '';
    state.refreshToken = '';
    state.user = null;
    persistAuth();
  }
});

document.getElementById('searchBtn').addEventListener('click', async () => {
  try {
    const params = new URLSearchParams();
    const fields = ['city', 'province', 'checkIn', 'checkOut', 'guests', 'limit'];
    fields.forEach((field) => {
      const value = document.getElementById(field).value;
      if (value) params.set(field, value);
    });

    const data = await request(`/properties?${params.toString()}`);
    renderProperties(data.data || []);
    setStatus({ message: 'Search completed', meta: data.meta });
  } catch (error) {
    setStatus(mapError(error));
  }
});

document.getElementById('quoteBtn').addEventListener('click', async () => {
  try {
    const payload = bookingPayload();
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    const quote = await request(`/bookings/quote?${params.toString()}`);
    setStatus({ message: 'Quote loaded', quote });
  } catch (error) {
    setStatus(mapError(error));
  }
});

document.getElementById('bookBtn').addEventListener('click', async () => {
  try {
    const booking = await request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingPayload()),
    });
    setStatus({ message: 'Booking created', booking });
  } catch (error) {
    setStatus(mapError(error));
  }
});

document.getElementById('myBookingsBtn').addEventListener('click', async () => {
  try {
    const bookings = await request('/bookings/my-bookings');
    setStatus({ message: 'My bookings', bookings });
  } catch (error) {
    setStatus(mapError(error));
  }
});

syncAuthUi();
setStatus(
  `Frontend ready.\nAPI base URL: ${config.API_BASE_URL}\nTip: search properties first, then select one to quote/book.`,
);
