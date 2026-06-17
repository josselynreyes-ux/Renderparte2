const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const usuarios = new Map();

app.get("/health", (req, res) => {
  res.json({ ok: true, message: "Servidor funcionando" });
});

io.on("connection", (socket) => {
  console.log("Usuario conectado:", socket.id);

  socket.on("registrarUsuario", (data) => {
    // data ahora contiene { nombre, sala }
    socket.join(data.sala);
    const usuario = {
      id: socket.id,
      nombre: data.nombre || "Anónimo",
      sala: data.sala
    };

    usuarios.set(socket.id, usuario);

    io.emit("usuariosActualizados", Array.from(usuarios.values()));
    // mensaje de sistema solo a la sala donde se unió
    io.to(data.sala).emit("mensajeSistema", `${usuario.nombre} se unió a ${data.sala}`);
  });

  socket.on("cambiarSala", (nuevaSala) => {
    const usuario = usuarios.get(socket.id);
    if (usuario) {
      socket.leave(usuario.sala);
      socket.join(nuevaSala);
      
      io.to(usuario.sala).emit("mensajeSistema", `${usuario.nombre} abandonó la sala`);
      usuario.sala = nuevaSala;
      usuarios.set(socket.id, usuario);
      
      io.to(nuevaSala).emit("mensajeSistema", `${usuario.nombre} se unió a la sala`);
      io.emit("usuariosActualizados", Array.from(usuarios.values()));
    }
  });

  socket.on("mensajeGlobal", (data) => {
    // enviamos el mensaje solo a la sala del usuario
    io.to(data.sala).emit("mensajeGlobal", {
      usuario: data.usuario,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    });
  });

  socket.on("mensajePrivado", (data) => {
    io.to(data.destinoId).emit("mensajePrivado", {
      usuario: data.usuario,
      mensaje: data.mensaje,
      hora: new Date().toLocaleTimeString()
    });
  });

  socket.on("disconnect", () => {
    const usuario = usuarios.get(socket.id);
    if (usuario) {
      usuarios.delete(socket.id);
      io.emit("usuariosActualizados", Array.from(usuarios.values()));
      // notificar salida a los de su sala
      io.to(usuario.sala).emit("mensajeSistema", `${usuario.nombre} se desconectó`);
    }
    console.log("Usuario desconectado:", socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});