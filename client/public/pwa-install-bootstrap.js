(function bootstrapRovautoPwaInstall() {
  var shell = document.documentElement.dataset.appShell || "main";
  var configs = {
    main: {
      key: "__ROVAUTO_INSTALL_PROMPT__",
      event: "rovauto-install-ready",
    },
    support: {
      key: "__ROVAUTO_SUPPORT_INSTALL_PROMPT__",
      event: "rovauto-support-install-ready",
    },
    admin: {
      key: "__ROVAUTO_ADMIN_INSTALL_PROMPT__",
      event: "rovauto-admin-install-ready",
    },
    intern: {
      key: "__ROVAUTO_INTERN_INSTALL_PROMPT__",
      event: "rovauto-intern-install-ready",
    },
    garage: {
      key: "__ROVAUTO_GARAGE_INSTALL_PROMPT__",
      event: "rovauto-garage-install-ready",
    },
  };
  var config = configs[shell] || configs.main;

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    window[config.key] = event;
    window.dispatchEvent(new Event(config.event));
  });

  window.addEventListener("appinstalled", function () {
    window[config.key] = null;
  });
})();
