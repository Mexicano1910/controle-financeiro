self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Controle Financeiro",
      body: event.data?.text() || "Você tem um novo aviso.",
    };
  }

  const title = data.title || "Controle Financeiro";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Você tem uma conta próxima do vencimento.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: data.url ? { url: data.url } : {},
      vibrate: [200, 100, 200],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((windows) => {
        for (const client of windows) {
          if ("focus" in client) {
            return client.focus();
          }
        }

        return clients.openWindow("/");
      }),
  );
});
