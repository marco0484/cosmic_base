 const API = window.location.hostname === "localhost"
  || window.location.hostname === "127.0.0.1"
  ? "http://localhost:3000"
  : "https://www.cosmicpass.space";


document.addEventListener("DOMContentLoaded", async () => {
  window.scrollTo(0, 0);
  initNavbar(); 
  initBotones();
  initMisBoletos();  
  if (document.querySelector(".cards")) {
    await cargarEventos();
    initBuscador();
  }

  const items = document.querySelectorAll(".legal-item");

  items.forEach(item => {
    const header = item.querySelector("h3");
    if (!header) return;
    header.addEventListener("click", () => {
      items.forEach(i => {
        if (i !== item) i.classList.remove("active");
      });
      item.classList.toggle("active");
    });
  });

});

function initNavbar() {
  const toggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelector(".nav-links");
  const loginBtn = document.querySelector(".login");

  if (loginBtn && localStorage.getItem("auth") === "true") {
    loginBtn.textContent = "Admin";
    loginBtn.href = "admin.html";
  }

  if (toggle && navLinks) {
    toggle.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });

    const links = document.querySelectorAll(".nav-links a");

    links.forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
      });
    });
  }
}

function initBotones() {
  const btnHome = document.getElementById("btnHome");
  if (btnHome) {
    btnHome.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  const btnExplorar = document.getElementById("btnExplorar");
  if (btnExplorar) {
    btnExplorar.addEventListener("click", () => {
      const eventos = document.getElementById("eventos");
      if (eventos) {
        eventos.scrollIntoView({ behavior: "smooth" });
      }
    });
  }
}

function initMisBoletos() {
  const form = document.getElementById("ticket-search-form");
  const container = document.getElementById("tickets-container");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const telefono = document.getElementById("telefono").value.trim();
    container.innerHTML = `
      <div class="ticket-item">
        <p>Estamos validando tu información...</p>
      </div>
    `;

    try {
      const res = await fetch(`${API}/mis-boletos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          telefono
        })
      });
      const result = await res.json();

      if (!result.success || !result.tickets?.length) {
        container.innerHTML = `
          <div class="ticket-item">
            <p>No encontramos boletos con esos datos</p>
          </div>
        `;
        return;
      }

      container.innerHTML = "";

      result.tickets.forEach(ticket => {
        container.innerHTML += `
          <div class="ticket-item">
            <h3>${ticket.tipo_ticket || "Ticket"}</h3>

            <p>
              <strong>Nombre:</strong>
              ${ticket.nombre_cliente || ""}
            </p>

            <p>
              <strong>Estatus:</strong>
              ${ticket.estatus || ""}
            </p>

            <img
              src="${ticket.qr_code}"
              alt="QR Ticket"
              style="max-width: 220px; margin-top: 15px;"
            />
          </div>
        `;
      });

    } catch (error) {
      container.innerHTML = `
        <div class="ticket-item">
          <p>Ocurrió un error al consultar tus boletos</p>
        </div>
      `;
    }
  });
}

async function cargarEventos() {
  try {
    const res = await fetch(`${API}/events`);
    const eventos = await res.json();

    eventosGlobal = eventos;
    eventosCache = eventos;

    renderEventos(eventos);

  } catch (error) {
    console.error(error);
  }
}

function renderEventos(lista){

  const container =
    document.querySelector(".cards");

  const pastContainer =
    document.querySelector(".past-cards");

  if (!container) return;

  container.innerHTML = "";

  if (pastContainer) {
    pastContainer.innerHTML = "";
  }

const now = new Date();

const activeEvents =
  lista.filter(e => {

    const eventDate =
      new Date(
        e.event_date ||
        e.date ||
        e.fecha
      );

    return eventDate >= now;

  });

const pastEvents =
  lista.filter(e => {

    const eventDate =
      new Date(
        e.event_date ||
        e.date ||
        e.fecha
      );

    return eventDate < now;

  });

  activeEvents.forEach(evento => {

    const card =
      document.createElement("div");

    card.classList.add("card");

    const fecha =
      new Date(evento.event_date);

    const fechaFormateada =
      fecha.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });

    card.innerHTML = `

      <div class="card-content">

        <div class="card-text">

          <h3>
            ${evento.name}

            <span class="by">
              by: ${evento.productora_name}
            </span>
          </h3>

          <p>
            ${evento.city}
            - ${fechaFormateada}
          </p>

          <p>
            ${
              Number(evento.price) === 0
                ? "Free Access"
                : `$${evento.price}`
            }
          </p>

          <button class="btn-card">

            ${
              Number(evento.price) === 0
                ? "Obtener Ticket"
                : "Comprar Ticket"
            }

          </button>

        </div>

        <div class="card-img-container">

          <img 
            src="${evento.image}" 
            alt="${evento.name}" 
            class="card-img"
            loading="lazy"
          >

        </div>

      </div>

    `;

card.addEventListener("click", () => {
                                        window.location.href = `/productora/${evento.desc_slug}`;

                                      });

    container.appendChild(card);

  });


  if(pastContainer){

    pastEvents.forEach(evento => {

      const card = document.createElement("div");
      card.classList.add("card");
      card.classList.add("past-event-card");
      const fecha = new Date(evento.event_date);

      const fechaFormateada =
        fecha.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "long",
          year: "numeric"
        });

      card.innerHTML = `

        <div class="card-content">

          <div class="card-text">

            <h3>
              ${evento.name}

              <span class="by">
                by: ${evento.productora_name}
              </span>
            </h3>

            <p>
              ${evento.city}
              - ${fechaFormateada}
            </p>

            <span class="past-label">
              Evento finalizado
            </span>

          </div>

          <div class="card-img-container">

            <img 
              src="${evento.image}" 
              alt="${evento.name}" 
              class="card-img"
              loading="lazy"
            >

          </div>

        </div>

      `;

      pastContainer.appendChild(card);

    });

  }

}

function initBuscador(){
  const input = document.querySelector(".search");
  if (!input) return;
  input.addEventListener("input", (e) => {
    const texto = e.target.value.toLowerCase();

    if (texto === "") {
      renderEventos(eventosGlobal);
      return;
    }

    const filtrados = eventosGlobal.filter(ev =>
      ev.name?.toLowerCase().includes(texto) ||
      ev.city?.toLowerCase().includes(texto) ||
      ev.description?.toLowerCase().includes(texto)
    );

    renderEventos(filtrados);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      input.blur();

      document.querySelector(".events")?.scrollIntoView({
        behavior: "smooth"
      });
    }
  });
}