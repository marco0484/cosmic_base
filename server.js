let cacheEventos = {};
const express = require("express");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");

require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_USER,
    pass: process.env.BREVO_PASSWORD
  }
});
const { createClient } = require("@supabase/supabase-js");
const HOST = "0.0.0.0";
const PORT = process.env.PORT || 3000;
const app = express();
const QRCode = require("qrcode");
const crypto = require("crypto");
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  throw new Error("Falta la variable SESSION_SECRET");
}

function crearSessionToken(usuario) {

  const payload = {
    id: Number(usuario.id),
    rol: String(usuario.rol || ""),
    id_productora: usuario.id_productora
      ? Number(usuario.id_productora)
      : null,
    exp: Date.now() + (8 * 60 * 60 * 1000)
  };

  const encodedPayload =
    Buffer.from(JSON.stringify(payload))
      .toString("base64url");

  const signature =
    crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(encodedPayload)
      .digest("base64url");

  return `${encodedPayload}.${signature}`;
}

function verificarSessionToken(token) {
  try {

    if (!token) {
      return null;
    }

    const partes = token.split(".");

    if (partes.length !== 2) {
      return null;
    }

    const [encodedPayload, signature] = partes;

    const expectedSignature = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(encodedPayload)
      .digest("base64url");

    const firmaReal = Buffer.from(signature);
    const firmaEsperada = Buffer.from(expectedSignature);

    if (
      firmaReal.length !== firmaEsperada.length ||
      !crypto.timingSafeEqual(firmaReal, firmaEsperada)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer
        .from(encodedPayload, "base64url")
        .toString("utf8")
    );

    if (!payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;

  } catch (error) {
    console.error("Error verificando sesión:", error);
    return null;
  }
}


function requerirSesion(req, res, next) {

  const cookieHeader = req.headers.cookie || "";

  const cookies = Object.fromEntries(
    cookieHeader
      .split(";")
      .map(cookie => cookie.trim())
      .filter(Boolean)
      .map(cookie => {

        const index = cookie.indexOf("=");

        if (index === -1) {
          return [cookie, ""];
        }

        return [
          cookie.substring(0, index),
          cookie.substring(index + 1)
        ];
      })
  );

  const token = cookies.cp_session;

  const sesion = verificarSessionToken(token);

  if (!sesion) {
    return res.status(401).json({
      success: false,
      error: "Sesión inválida o expirada"
    });
  }

  req.usuario = sesion;

  next();
}

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {

  if (req.originalUrl === "/webhook-stripe") {
    next();
  } else {
    express.json()(req, res, next);
  }

});

const {
  MercadoPagoConfig,
  Preference,
  Payment
} = require("mercadopago");


const Stripe = require('stripe');

const stripe = Stripe(
  process.env.STRIPE_TOKEN
);

const endpointSecret =
  process.env.STRIPE_WEBHOOK_SECRET;


app.post(
  "/webhook-stripe",
  express.raw({ type: "*/*" }),
 async (req, res) => {

    const sig =
      req.headers["stripe-signature"];

    try {

      const event =
        stripe.webhooks.constructEvent(
          req.body,
          sig,
          endpointSecret
        );

      if (
        event.type ===
        "checkout.session.completed"
      ) {

        const session =
          event.data.object;

          const { data: existe } =
  await supabase
    .from("tickets")
    .select("id")
    .eq(
      "payment_id",
      session.payment_intent
    )
    .maybeSingle();

if (existe) {
  return res.json({
    received: true
  });
}

const ticketToken =
  crypto.randomUUID();

const folio =
  `CP-${Date.now()}`;

const { error } =
  await supabase
    .from("tickets")
    .insert([{

      evento_id:
        Number(
          session.metadata.evento_id
        ),

      nombre_cliente:
        session.customer_details?.name ||
        "Cliente Stripe",

     correo:
  session.customer_details?.email ||
  null,

telefono:
  session.customer_details?.phone ||
  null,

      cantidad:
        Number(
          session.metadata.cantidad
        ),

      monto:
        session.amount_total / 100,

      metodo_pago:
        "STRIPE",

      payment_id:
        session.payment_intent,

      payment_status:
        "paid",

      fecha_pago:
        new Date(),

      estatus:
        "pendiente",

      ticket_type_id:
        Number(
          session.metadata.ticket_id
        ),

      ticket_token:
        ticketToken,

      folio:
        folio

    }]);

if (error) {

} else {


 const rpcResult =
  await supabase.rpc(
    "descontar_stock",
    {
      p_ticket_id: Number(
        session.metadata.ticket_id
      ),
      p_cantidad: Number(
        session.metadata.cantidad
      )
    }
  );

const {
  data: nuevoStock,
  error: stockError
} = rpcResult;

if (stockError) {
} 
else {
}
}

      }

      return res.json({
        received: true
      });

    } catch (err) {

      console.error(err);

      return res
        .status(400)
        .send(err.message);

    }

  }
);

app.get("/productora/:slug", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "productora.html")
  );
});

const supabase = createClient("https://uqrbykxgsarsfyyvmibr.supabase.co",process.env.SUPABASE_SECRET_KEY);

app.post("/login", async (req, res) => {
  try {
    const { user, password } = req.body;

    if (!user || !password) {
      return res.status(400).json({
        success: false,
        error: "Usuario y contraseña requeridos"
      });
    }

const { data: usuarios, error } = await supabase.rpc(
  "validar_login_cosmic",
  {
    p_usuario: user,
    p_password: password
  }
);

const data =
  usuarios && usuarios.length > 0
    ? usuarios[0]
    : null;

if (error || !data) {
  return res.status(401).json({
    success: false,
    error: "Credenciales incorrectas"
  });
}

    let nombreProductora = "Cosmic Pass";

    if (data.id_productora) {
      const {
        data: productora,
        error: productoraError
      } = await supabase
        .from("cat_productoras")
        .select("name")
        .eq("id", data.id_productora)
        .maybeSingle();

      if (productoraError) {
        console.error(
          "ERROR CONSULTANDO PRODUCTORA:",
          productoraError
        );
      }

      if (productora?.name) {
        nombreProductora = productora.name;
      }
    }

const usuarioSesion = {
  id: data.id,
  nombre: data.nombre || data.usuario,
  usuario: data.usuario,
  rol: data.rol || "admin",
  id_productora: data.id_productora,
  productora_nombre: nombreProductora
};

const sessionToken = crearSessionToken(usuarioSesion);

res.setHeader(
  "Set-Cookie",
  `cp_session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
);

return res.json({
  success: true,
  user: usuarioSesion
});

  } catch (err) {
    console.error("ERROR LOGIN:", err);

    return res.status(500).json({
      success: false,
      error: "Error en servidor"
    });
  }
});

app.post("/scanner/token", requerirSesion, async (req, res) => {
  try {

const { evento_id = null } = req.body;

const userId = Number(req.usuario.id);

if (!userId) {
  return res.status(401).json({
    success: false,
    error: "Sesión de usuario inválida"
  });
}

    const { data: user, error } = await supabase
      .from("cosmic_usuarios")
      .select(`
        id,
        nombre,
        usuario,
        rol,
        activo,
        id_productora
      `)
      .eq("id", userId)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({
        success: false,
        error: "Usuario no encontrado"
      });
    }

    if (!user.activo) {
      return res.status(403).json({
        success: false,
        error: "Usuario inactivo"
      });
    }

if (!user.id_productora) {
    return res.status(403).json({
        success: false,
        error: "Sin productora asignada"
    });
}

    const token = crypto.randomUUID();

    const expires_at = new Date(
      Date.now() + (5 * 60 * 1000)
    );

    const { error: insertError } =
      await supabase
        .from("scanner_sessions")
        .insert({
                  token,
                  user_id: user.id,
                  id_productora: user.id_productora,
                  id_evento: evento_id,
                  expires_at,
                  used: false
                });

    if (insertError) {
      console.error(insertError);

      return res.status(500).json({
        success: false,
        error: "No fue posible crear el token"
      });
    }

    return res.json({
      success: true,
      token,
      expires_at
    });

  } catch (err) {

    console.error(err);

    return res.status(500).json({
      success: false,
      error: "Error interno"
    });

  }

});

app.get("/admin/dashboard", requerirSesion, async (req, res) => {
  try {
const rol =
  String(req.usuario.rol || "").toLowerCase();

const idProductoraSesion =
  Number(req.usuario.id_productora) || null;

const esOwner =
  rol === "owner" ||
  (rol === "admin" && !idProductoraSesion);

if (!esOwner && !idProductoraSesion) {
  return res.status(403).json({
    success: false,
    error: "Usuario sin productora asignada"
  });
}

const idProductora =
  esOwner
    ? null
    : idProductoraSesion;

    const { data, error } = await supabase.rpc("get_dashboard",
      {
        p_id_productora: idProductora
      }
    );

    if (error) {
      throw error;
    }

    const metricas = data || {
      eventos: 0,
      tickets: 0,
      ingresos: 0,
      productoras: idProductora ? 1 : 0
    };

    return res.json({
      success: true,
      scope: idProductora
        ? "productora"
        : "admin",
      id_productora: idProductora,
      metricas: {
                eventos: Number(metricas.eventos || 0),
                emitidos: Number(metricas.emitidos || 0),
                asignados: Number(metricas.asignados || 0),
                tickets: Number(metricas.tickets || 0),
                disponibles: Number(metricas.disponibles || 0),
                cortesias: Number(metricas.cortesias || 0),
                ingresos: Number(metricas.ingresos || 0),
                productoras: Number(metricas.productoras || 0)
              }
    });

  } catch (error) {
    console.error(
      "ERROR /admin/dashboard:",
      error
    );

    return res.status(500).json({
      success: false,
      error: "Error cargando dashboard"
    });
  }
});

app.get("/scanner/validate", async (req, res) => {

  try {

    const token = req.query.token;

    if (!token) {
      return res.status(400).json({
        success:false,
        error:"Token requerido"
      });
    }

    const { data, error } =
      await supabase
      .from("scanner_sessions")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (error || !data) {
      return res.status(401).json({
        success:false,
        error:"Token inválido"
      });
    }

    if (data.used) {
      return res.status(401).json({
        success:false,
        error:"Token ya utilizado"
      });
    }

    if (new Date(data.expires_at) < new Date()) {

      return res.status(401).json({
        success:false,
        error:"Token expirado"
      });

    }

    const {
      data:user,
      error:userError
    } = await supabase
      .from("cosmic_usuarios")
      .select(`
        id,
        nombre,
        usuario,
        rol,
        activo,
        id_productora
      `)
      .eq("id", data.user_id)
      .maybeSingle();

    if (userError || !user || !user.activo) {

      return res.status(401).json({
        success:false
      });

    }

    await supabase
      .from("scanner_sessions")
      .update({
        used:true
      })
      .eq("token", token);

      let nombreProductora = "Cosmic Pass";

if (user.id_productora) {

  const { data: productora } = await supabase
    .from("cat_productoras")
    .select("name")
    .eq("id", user.id_productora)
    .maybeSingle();

  if (productora?.name) {
    nombreProductora = productora.name;
  }

}

 return res.json({
  success: true,
  user: {
    id: user.id,
    nombre: user.nombre,
    usuario: user.usuario,
    rol: user.rol,
    id_productora: user.id_productora,
    productora_nombre: nombreProductora,
    id_evento: data.id_evento
  }
});

  } catch(err){

    console.error(err);

    res.status(500).json({
      success:false
    });

  }

});

app.post("/admin/activar-cortesias", async (req, res) => {
  try {
    const {
      id_productora,
      evento_id,
      cantidad
    } = req.body;

    const idProductora = Number(id_productora);
    const eventoId = Number(evento_id);
    const cantidadAgregar = Number(cantidad);

    if (
      !idProductora ||
      !eventoId ||
      !Number.isInteger(cantidadAgregar) ||
      cantidadAgregar <= 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Datos inválidos"
      });
    }

    const { data: ticket, error: ticketError } =
      await supabase
        .from("ticket_types")
        .select(`
          id,
          id_evento,
          id_productora,
          precio,
          stock_disponible
        `)
        .eq("id_evento", eventoId)
        .eq("id_productora", idProductora)
        .eq("precio", 0)
        .eq("ind_activo", 1)
        .maybeSingle();

    if (ticketError) {
      throw ticketError;
    }

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: "Este evento no tiene un acceso gratuito configurado"
      });
    }

    const nuevoStock =
      Number(ticket.stock_disponible || 0) +
      cantidadAgregar;

    const { error: updateError } =
      await supabase
        .from("ticket_types")
        .update({
          stock_disponible: nuevoStock
        })
        .eq("id", ticket.id);

    if (updateError) {
      throw updateError;
    }

    return res.json({
      success: true,
      message: `${cantidadAgregar} cortesías activadas correctamente`
    });

  } catch (error) {
    console.error("ERROR ACTIVANDO CORTESÍAS:", error);

    return res.status(500).json({
      success: false,
      error: "No se pudieron activar las cortesías"
    });
  }
});

app.post("/stripe/connect/:productoraId", async (req, res) => {
  try {
    const { productoraId } = req.params;

    const account = await stripe.accounts.create({
      type: "standard"
    });

    const { error } = await supabase
      .from("cat_productoras")
      .update({
        stripe_account_id: account.id,
        stripe_onboarding_complete: false
      })
      .eq("id", productoraId);

    if (error) {
      throw error;
    }

    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `https://www.cosmicpass.space/productora.html?id=${productoraId}`,
      return_url: `https://www.cosmicpass.space/productora.html?id=${productoraId}`,
      type: "account_onboarding"
    });

    res.json({
      success: true,
      url: accountLink.url,
      stripe_account_id: account.id
    });

  } catch (error) {
    console.error("ERROR STRIPE CONNECT:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/api/productora/:slug", async (req, res) => {  try {

    const slug = req.params.slug;

    const { data: productoraSlug, error: slugError } =
      await supabase
        .from("cat_productoras")
        .select("id")
        .eq("desc_slug", slug)
        .single();

    if (slugError || !productoraSlug) {
      return res.status(404).json({
        error: "Productora no encontrada"
      });
    }

    const id = productoraSlug.id;

    // ↓↓↓ A partir de aquí TODO queda igual ↓↓↓

    const [prod, eventos, features] = await Promise.all([

      supabase.rpc("get_productora_by_id", {
        p_id: id
      }),

      supabase.rpc("get_events_by_productora", {
        p_id: id
      }),

      supabase.rpc("get_productora_features", {
        p_id: id
      })

    ]);

    if (prod.error) throw prod.error;
    if (eventos.error) throw eventos.error;
    if (features.error) throw features.error;

    res.json({
      productora: prod.data?.[0] || null,
      eventos: eventos.data || [],
      features: features.data || []
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Error en servidor"
    });

  }
});


app.post("/crear-pago-stripe", async (req, res) => {

  try {

    const {
      ticket_id,
      cantidad = 1
    } = req.body;

    const { data: ticket, error } =
  await supabase
    .from("ticket_types")
    .select(`
            id,
            id_evento,
            id_productora,
            tipo_ticket,
            precio,
            stock_disponible
          `)
    .eq("id", ticket_id)
    .single();

    if (error || !ticket) {

      return res.status(404).json({
        error: "Ticket no encontrado"
      });

    }
if (
  ticket.stock_disponible !== null &&
  ticket.stock_disponible < Number(cantidad)
) {

  return res.status(400).json({
    error: "Stock insuficiente"
  });

}

const { data: productora, error: productoraError } =
  await supabase
    .from("cat_productoras")
    .select("stripe_account_id")
    .eq("id", ticket.id_productora)
    .single();

if (productoraError || !productora?.stripe_account_id) {

  return res.status(400).json({
    error: "La productora no tiene Stripe conectado"
  });

}

    const session =
  await stripe.checkout.sessions.create({

    metadata: {
      ticket_id: String(ticket.id),
      evento_id: String(ticket.id_evento),
      cantidad: String(cantidad)
    },

    payment_method_types: ["card"],
    phone_number_collection: {
      enabled: true
    },

  line_items: [
  {
    price_data: {
      currency: "mxn",
      product_data: {
        name: ticket.tipo_ticket
      },
      unit_amount:
        Math.round(
          Number(ticket.precio) * 100
        )
    },
    quantity:
      Number(cantidad)
  }
],
    mode: "payment",
    success_url:
      "https://www.cosmicpass.space/successful.html",

    cancel_url:
      "https://www.cosmicpass.space/error.html",
      payment_intent_data: {
  application_fee_amount: 0,
  transfer_data: {
    destination:
      productora.stripe_account_id
  }
},

  });

    res.json({
      checkout_url: session.url
    });

  } catch (err) {

    console.error(
      "STRIPE ERROR:",
      err
    );

    res.status(500).json({
      error: err.message
    });

  }

});

app.get("/mp/connect/:productoraId", async (req, res) => {

  try {

    const productoraId = Number(req.params.productoraId);

    if (!productoraId) {

      return res.status(400).json({
        success: false,
        error: "Productora inválida"
      });

    }

    const state = Buffer
      .from(JSON.stringify({
        productoraId
      }))
      .toString("base64url");

    const authorizationUrl =
      "https://auth.mercadopago.com/authorization" +
      "?response_type=code" +
      `&client_id=${encodeURIComponent(process.env.MP_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(process.env.MP_REDIRECT_URI)}` +
      `&state=${encodeURIComponent(state)}`;

    return res.redirect(authorizationUrl);

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      success:false,
      error:"No fue posible iniciar la conexión."
    });

  }

});


app.get("/mp/oauth/callback", async (req, res) => {

  try {

    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send("Solicitud inválida.");
    }

    const {
      productoraId
    } = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    );

    const response = await fetch(
      "https://api.mercadopago.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id: process.env.MP_CLIENT_ID,
          client_secret: process.env.MP_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: process.env.MP_REDIRECT_URI
        })
      }
    );

    const tokenData = await response.json();

    if (!response.ok) {
      console.error(tokenData);
      return res.status(400).json(tokenData);
    }

    const { error } = await supabase
      .from("cat_productoras")
      .update({

        mp_access_token: tokenData.access_token,

        mp_refresh_token: tokenData.refresh_token,

        mp_user_id: String(tokenData.user_id),

        mp_connected: true,

        mp_token_expires_at: new Date(
          Date.now() + tokenData.expires_in * 1000
        )

      })
      .eq("id", productoraId);

    if (error)
      throw error;

    res.redirect(
      `/productora.html?id=${productoraId}&mp=connected`
    );

  } catch (error) {

    console.error(error);

    res.status(500).send(
      "Error conectando Mercado Pago."
    );

  }

});

app.get("/events", async (req, res) => {
  try {

    const { id_productora } = req.query;
    const key = id_productora || "all";
    const now = Date.now();
    if (
      cacheEventos[key] &&
      (now - cacheEventos[key].time < 300000)
    ) {
      return res.json(cacheEventos[key].data);
    }

    const { data, error } = await supabase.rpc("get_events", {
      p_id_productora: id_productora ? parseInt(id_productora) : null
    });

    if (error) throw error;

    cacheEventos[key] = {
      data,
      time: now
    };

    res.json(data);

  } catch (error) {
    res.status(500).json({ error: "Error en servidor" });
  }
});

app.get("/events/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const { data, error } = await supabase.rpc("get_productora_by_id", {
      p_id: id
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Evento no encontrado" });
    }

    res.json(data[0]);

  } catch (error) {
    res.status(500).json({ error: "Error en servidor" });
  }
});

app.get("/productoras/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const { data, error } = await supabase.rpc("get_productora_by_id", {
      p_id: id
    });

    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Productora no encontrada" });
    }

    res.json(data[0]);

  } catch (error) {
    res.status(500).json({ error: "Error en servidor" });
  }
});


app.get("/productoras/:id/eventos", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const { data, error } = await supabase.rpc("get_events_by_productora", {
      p_id: id
    });

    if (error) throw error;

    res.json(data);

  } catch (error) {
    res.status(500).json({ error: "Error en servidor" });
  }
});


app.get("/productoras/:id/detalle/:eventoId", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const eventoId = parseInt(req.params.eventoId);

    const { data, error } = await supabase.rpc("get_detalle_productora", {
      p_id: id,
      p_evento: eventoId
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Detalle no encontrado" });
    }

    res.json(data[0]);

  } catch (error) {
    res.status(500).json({ error: "Error en servidor" });
  }
});


app.post("/contacto", async (req, res) => {
  try {
    const { nombre, email, mensaje } = req.body;

    if (!nombre || !email || !mensaje) {
      return res.status(400).json({ error: "Faltan datos" });
    }

    const { data, error } = await supabase.rpc("insert_contacto", {
      p_nombre: nombre,
      p_email: email,
      p_mensaje: mensaje
    });

    if (error) throw error;

    res.json({ ok: true, data });

  } catch (error) {
    res.status(500).json({ error: "Error del servidor" });
  }
});


app.get("/eventos/buscar", async (req, res) => {
  try {
    const { q } = req.query;

    const { data, error } = await supabase
      .from("cat_events")
      .select("*")
      .ilike("name", `%${q}%`);

    if (error) throw error;

    res.json(data);

  } catch (error) {
    res.status(500).send("Error");
  }
});

app.get("/productoras/:id/features", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const { data, error } = await supabase.rpc("get_productora_features", {
      p_id: id
    });

    if (error) throw error;

    res.json(data);

  } catch (error) {
    res.status(500).json({ error: "Error en servidor" });
  }
});

app.get("/eventos/:id/tickets", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data, error } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("id_evento", id)
      .eq("ind_activo", 1)
      .order("precio", { ascending: true });

    if (error) throw error;

    res.json(data);

  } catch (error) {

    res.status(500).json({
      error: "Error en servidor"
    });
  }
});


app.post("/crear-ticket-gratis", async (req, res) => {
  try {
    const { ticket_id, cantidad = 1, nombre, correo, telefono } = req.body;
    const correoNormalizado =
  String(correo || "")
    .trim()
    .toLowerCase();

const telefonoNormalizado =
  String(telefono || "")
    .replace(/\D/g, "");

  if (
  !ticket_id ||
  !nombre ||
  !correoNormalizado ||
  !telefonoNormalizado
) {
      return res.status(400).json({
        success:false,
        error:"Faltan datos obligatorios"
      });
    }

    const { data: ticket, error } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("id", ticket_id)
      .eq("ind_activo", 1)
      .single();

    if (error || !ticket) {
      return res.status(404).json({
        success:false,
        error:"Ticket no encontrado"
      });
    }

    if (Number(ticket.precio) !== 0) {
      return res.status(400).json({
        success:false,
        error:"Este ticket no es gratuito"
      });
    }

  const { data: evento, error: eventoError } = await supabase
  .from("cat_events")
  .select(`
    name,
    city,
    date,
    image
  `)
  .eq("id", ticket.id_evento)
  .single();

if (eventoError || !evento) {
  return res.status(404).json({
    success:false,
    error:"Evento no encontrado"
  });
}

    if (ticket.stock_disponible !== null && ticket.stock_disponible < Number(cantidad)) {
      return res.status(400).json({
        success:false,
        error:"Stock insuficiente"
      });
    }

    const ticketToken = crypto.randomUUID();
    const folio = `CP-${Date.now()}`;
    const qrImage = await QRCode.toDataURL(ticketToken, {
      width:300,
      margin:2,
      errorCorrectionLevel:"H"
    });

    const { error: insertError } = await supabase
      .from("tickets")
      .insert([{
        evento_id:ticket.id_evento,
        nombre_cliente:nombre,
        correo,
        telefono,
        cantidad:1,
        monto:0,
        metodo_pago:"FREE_ACCESS",
        payment_id:null,
        payment_status:"free",
        fecha_pago:new Date(),
        estatus:"pendiente",
        ticket_type_id:ticket.id,
        ticket_token:ticketToken,
        folio
      }]);

    if (insertError) {
      return res.status(500).json({
        success:false,
        error:insertError.message
      });
    }

    await supabase.rpc("descontar_stock", {
      p_ticket_id:ticket.id,
      p_cantidad:1
    });

    try {
      await transporter.sendMail({
        from:'"Cosmic Pass" <cosmicpass0484@gmail.com>',
        to:correo,
        subject:"Tu acceso Cosmic Pass 🎟️",
       html:`
  <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:24px;">
    <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      
      <img src="${evento.image}" style="width:100%;display:block;" />

      <div style="padding:24px;">
        <h1 style="margin:0 0 10px;">🎉 Tu acceso está listo</h1>

        <h2 style="margin:0 0 16px;color:#111;">
          ${evento.name}
        </h2>

        <p><strong>📍 Lugar:</strong> ${evento.city || "Por confirmar"}</p>
        <p><strong>📅 Fecha:</strong> ${evento.date || "Por confirmar"}</p>

        <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;" />

        <p><strong>👤 Nombre:</strong> ${nombre}</p>
        <p><strong>🎟️ Tipo de acceso:</strong> ${ticket.tipo_ticket}</p>
        <p><strong>🔖 Folio:</strong> ${folio}</p>

        <div style="text-align:center;margin:28px 0;">
          <p><strong>Presenta este QR en el acceso:</strong></p>
          <img src="cid:ticketqr" width="260" />
        </div>

        <p style="font-size:14px;color:#555;">
          Este QR es único y válido para un solo ingreso. No lo compartas con terceros.
        </p>

        <p style="margin-top:24px;">
          Gracias por usar <strong>Cosmic Pass</strong> 🚀
        </p>
      </div>

    </div>
  </div>
`,
        attachments:[
          {
            filename:"ticket-qr.png",
            content:qrImage.split("base64,")[1],
            encoding:"base64",
            cid:"ticketqr"
          }
        ]
      });
    } catch (mailError) {
      console.error("ERROR ENVIANDO CORREO FREE ACCESS:", mailError);
    }

    res.json({
      success:true,
      message:"Acceso gratuito generado correctamente"
    });

  } catch (err) {
    res.status(500).json({
      success:false,
      error:err.message
    });
  }
});

app.post("/crear-pago-ticket", async (req, res) => {
  try {

const {
  ticket_id,
  cantidad = 1,
  nombre,
  correo,
  telefono
} = req.body;

    if (!ticket_id) {
      return res.status(400).json({
        error: "ticket_id es requerido"
      });
    }

const { data: ticket, error } = await supabase
  .from("ticket_types")
  .select(`
        id,
        id_productora,
        tipo_ticket,
        precio,
        stock_disponible,
        fecha_inicio,
        fecha_fin,
        ind_activo
  `)
  .eq("id", ticket_id)
  .eq("ind_activo", 1)
  .single();

  const { data: productora, error: errorProductora } =
await supabase
    .from("cat_productoras")
    .select("mp_access_token")
    .eq("id", ticket.id_productora)
    .single();

if (errorProductora || !productora?.mp_access_token) {
    return res.status(400).json({
        error: "La productora no tiene Mercado Pago conectado."
    });
}

    if (error || !ticket) {
      return res.status(404).json({
        error: "Ticket no encontrado"
      });
    }

    const ahora = new Date();

    if (
      ticket.fecha_inicio &&
      new Date(ticket.fecha_inicio) > ahora
    ) {
      return res.status(400).json({
        error: "Este ticket aún no está disponible"
      });
    }

    if (
      ticket.fecha_fin &&
      new Date(ticket.fecha_fin) < ahora
    ) {
      return res.status(400).json({
        error: "Este ticket ya expiró"
      });
    }

    if (
      ticket.stock_disponible !== null &&
      ticket.stock_disponible <= 0
    ) {
      return res.status(400).json({
        error: "Boletos agotados"
      });
    }

const mpClientProductora = new MercadoPagoConfig({ accessToken: productora.mp_access_token });
const preference = new Preference(mpClientProductora);    const result = await preference.create({

      body: {
       items: [
  {
    title: ticket.tipo_ticket,
    quantity: Number(cantidad),
    unit_price: Number(ticket.precio),
    currency_id: "MXN"
  }
],
metadata: {
  nombre,
  correo,
  telefono
},
notification_url:
  "https://www.cosmicpass.space/webhook-mp",
back_urls: {
  success: "https://www.cosmicpass.space/successful.html",
  failure: "https://www.cosmicpass.space/error.html",
  pending: "https://www.cosmicpass.space"
},
auto_return: "approved",
external_reference: JSON.stringify({
    ticket_id: ticket.id,
    productora_id: ticket.id_productora
})
      }

    });

    res.json({
      success: true,
      init_point: result.init_point
    });

  } catch (err) {

    console.error("MP ERROR:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.post("/webhook-mp", async (req, res) => {
  try {

    if ((req.body.type || req.body.topic) !== "payment") {
      return res.sendStatus(200);
    }

    const paymentId =
      req.body.data?.id ||
      req.body.resource;

    if (!paymentId) {
      return res.sendStatus(200);
    }

    if (!req.body.user_id) {
      return res.sendStatus(200);
    }

    const {
      data: productora,
      error: productoraError
    } = await supabase
      .from("cat_productoras")
      .select(`
        id,
        name,
        mp_user_id,
        mp_access_token
      `)
      .eq("mp_user_id", String(req.body.user_id))
      .single();

    if (productoraError || !productora) {
      console.error("PRODUCTORA NO ENCONTRADA");
      return res.sendStatus(200);
    }

    const mpClientProductora =
      new MercadoPagoConfig({
        accessToken: productora.mp_access_token
      });

    const payment =
      new Payment(mpClientProductora);

    const pago = await payment.get({
      id: paymentId
    });

    if (pago.status !== "approved") {
      return res.sendStatus(200);
    }

    const { data: existe } =
      await supabase
        .from("tickets")
        .select("id")
        .eq("payment_id", String(pago.id))
        .maybeSingle();

    if (existe) {
      return res.sendStatus(200);
    }

    const reference = JSON.parse(pago.external_reference);
    const ticketId = Number(reference.ticket_id);

    const cantidad =
      Number(
        pago.additional_info?.items?.[0]?.quantity || 1
      );

    // Obtener información del ticket
    const {
      data: ticketInfo,
      error: ticketError
    } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("id", ticketId)
      .single();

    if (ticketError || !ticketInfo) {
      console.error("ERROR TICKET:");
      console.error(ticketError);
      return res.sendStatus(200);
    }

    const ticketToken =
      crypto.randomUUID();

    const folio =
      `CP-${Date.now()}`;

    const { error: insertError } =
      await supabase
        .from("tickets")
        .insert([{
          evento_id: ticketInfo.id_evento,

          nombre_cliente:
            pago.metadata?.nombre ||
            "Cliente Mercado Pago",

          correo:
            pago.metadata?.correo ||
            pago.payer?.email ||
            null,

          telefono:
            pago.metadata?.telefono ||
            null,

          cantidad,

          monto:
            pago.transaction_amount,

          metodo_pago:
            "MERCADO_PAGO",

          payment_id:
            String(pago.id),

          payment_status:
            pago.status,

          fecha_pago:
            new Date(),

          estatus:
            "pendiente",

          ticket_type_id:
            ticketInfo.id,

          ticket_token:
            ticketToken,

          folio
        }]);

    if (insertError) {
      console.error("ERROR INSERTANDO TICKET:");
      console.error(insertError);
      return res.sendStatus(200);
    }

    await supabase.rpc(
      "descontar_stock",
      {
        p_ticket_id: ticketInfo.id,
        p_cantidad: cantidad
      }
    );

    return res.sendStatus(200);

  } catch (err) {

    console.error("ERROR WEBHOOK MP:");
    console.error(err);
    return res.sendStatus(200);

  }
});
module.exports = app;