import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiBell,
  FiCheck,
  FiChevronDown,
  FiChevronUp,
  FiLock,
  FiLogOut,
  FiMessageSquare,
  FiPhone,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { setNotifications } from "@/store/garageSlice";
import { useApp } from "@/hooks/useApp";
import { garageApi } from "@/api/garage";

const inputClass =
  "h-10 w-full rounded-lg border border-line px-3 text-sm outline-none transition focus:border-ink";

export default function GarageSettings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const notifications = useSelector((state) => state.garage.notifications);
  const { garageToken, logoutGarage } = useApp();

  const [activeSection, setActiveSection] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const settingsItems = [
    {
      id: "notifications",
      icon: FiBell,
      title: "Notifications",
      description: "Manage your notification preferences",
      type: "toggle-group",
    },
    {
      id: "password",
      icon: FiLock,
      title: "Change Password",
      description: "Update your account password",
      type: "form",
    },
    {
      id: "logout",
      icon: FiLogOut,
      title: "Logout",
      description: "Sign out of your garage account",
      type: "danger",
    },
    {
      id: "delete",
      icon: FiTrash2,
      title: "Delete Account",
      description: "Permanently delete your account",
      type: "danger",
    },
  ];

  const handleNotificationToggle = (type, value) => {
    dispatch(
      setNotifications({
        ...notifications,
        [type]: value,
      })
    );
  };

  const handlePasswordChange = async (event) => {
    event.preventDefault();

    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);

    if (!passwordForm.currentPassword) {
      setPasswordError("Current password is required.");
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      setPasswordLoading(false);
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match.");
      setPasswordLoading(false);
      return;
    }

    try {
      await garageApi.changePassword(
        garageToken,
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      setPasswordSuccess("Password changed successfully.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(
        err.response?.data?.message ||
          err.message ||
          "Unable to change password"
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    setActionLoading(true);
    await logoutGarage();
    navigate("/garage/login");
  };

  const handleDeleteAccount = async () => {
    setActionLoading(true);
    setDeleteError("");

    try {
      await garageApi.deleteAccount();
      await logoutGarage();
      navigate("/");
    } catch (err) {
      setDeleteError(
        err.response?.data?.message ||
          err.message ||
          "Unable to delete this garage account",
      );
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 overflow-x-hidden">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your garage account preferences.
        </p>
      </div>

      <section className="grid gap-3">
        {settingsItems.map((item) => {
          const Icon = item.icon;
          const isOpen = activeSection === item.id;
          const isDanger = item.type === "danger";

          return (
            <article
              key={item.id}
              className="card-soft overflow-hidden rounded-2xl shadow-sm"
            >
              <button
                type="button"
                onClick={() => {
                  if (isDanger) {
                    if (item.id === "logout") setShowLogoutModal(true);
                    if (item.id === "delete") {
                      setDeleteError("");
                      setShowDeleteModal(true);
                    }
                    return;
                  }

                  setActiveSection(isOpen ? null : item.id);
                }}
                className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-bg-soft"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={[
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      isDanger
                        ? "bg-red-50 text-red-700"
                        : "bg-bg-soft text-ink",
                    ].join(" ")}
                  >
                    <Icon />
                  </div>

                  <div className="min-w-0">
                    <h3
                      className={[
                        "font-bold",
                        isDanger ? "text-red-700" : "text-ink",
                      ].join(" ")}
                    >
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {item.description}
                    </p>
                  </div>
                </div>

                {!isDanger &&
                  (isOpen ? (
                    <FiChevronUp className="shrink-0 text-muted" />
                  ) : (
                    <FiChevronDown className="shrink-0 text-muted" />
                  ))}
              </button>

              {item.id === "notifications" && isOpen && (
                <div className="border-t border-line p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center justify-between gap-3 rounded-xl bg-bg-soft p-4">
                      <div className="flex items-center gap-3">
                        <FiMessageSquare className="text-muted" />
                        <span className="text-sm font-semibold text-ink">
                          WhatsApp Notifications
                        </span>
                      </div>

                      <input
                        type="checkbox"
                        checked={Boolean(notifications?.whatsapp)}
                        onChange={(event) =>
                          handleNotificationToggle(
                            "whatsapp",
                            event.target.checked
                          )
                        }
                        className="h-5 w-5 accent-emerald-500"
                      />
                    </label>

                    <label className="flex items-center justify-between gap-3 rounded-xl bg-bg-soft p-4">
                      <div className="flex items-center gap-3">
                        <FiPhone className="text-muted" />
                        <span className="text-sm font-semibold text-ink">
                          SMS Notifications
                        </span>
                      </div>

                      <input
                        type="checkbox"
                        checked={Boolean(notifications?.sms)}
                        onChange={(event) =>
                          handleNotificationToggle("sms", event.target.checked)
                        }
                        className="h-5 w-5 accent-emerald-500"
                      />
                    </label>
                  </div>
                </div>
              )}

              {item.id === "password" && isOpen && (
                <div className="border-t border-line p-4">
                  <form
                    onSubmit={handlePasswordChange}
                    className="grid gap-4"
                  >
                    {passwordError && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <FiX className="shrink-0" />
                        <span>{passwordError}</span>
                      </div>
                    )}

                    {passwordSuccess && (
                      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        <FiCheck className="shrink-0" />
                        <span>{passwordSuccess}</span>
                      </div>
                    )}

                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="grid gap-1.5 text-sm font-semibold text-ink">
                        Current Password
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(event) =>
                            setPasswordForm({
                              ...passwordForm,
                              currentPassword: event.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Current password"
                          required
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-semibold text-ink">
                        New Password
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(event) =>
                            setPasswordForm({
                              ...passwordForm,
                              newPassword: event.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="New password"
                          required
                        />
                      </label>

                      <label className="grid gap-1.5 text-sm font-semibold text-ink">
                        Confirm Password
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(event) =>
                            setPasswordForm({
                              ...passwordForm,
                              confirmPassword: event.target.value,
                            })
                          }
                          className={inputClass}
                          placeholder="Confirm password"
                          required
                        />
                      </label>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-bold text-black transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {passwordLoading
                          ? "Changing..."
                          : "Change Password"}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
                <FiLogOut className="text-2xl" />
              </div>

              <h3 className="text-xl font-bold text-ink">Logout</h3>

              <p className="mt-2 text-sm text-muted">
                Are you sure you want to log out?
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={actionLoading}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleLogout}
                disabled={actionLoading}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
              >
                {actionLoading ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-700">
                <FiAlertTriangle className="text-2xl" />
              </div>

              <h3 className="text-xl font-bold text-ink">Delete Account</h3>

              <p className="mt-2 text-sm text-muted">
                This will permanently delete your account. Humanity has invented
                undo buttons, but not for this.
              </p>
            </div>

            {deleteError && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <FiAlertCircle className="shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={actionLoading}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-line px-4 text-sm font-semibold text-ink transition hover:border-ink hover:bg-bg-soft disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={actionLoading}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-red-700 px-4 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60"
              >
                {actionLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
