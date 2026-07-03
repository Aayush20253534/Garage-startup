import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  FiBell,
  FiMessageSquare,
  FiPhone,
  FiLock,
  FiLogOut,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiCheck,
  FiX,
  FiAlertTriangle,
} from "react-icons/fi";
import { setNotifications } from "@/store/garageSlice";
import { useApp } from "@/hooks/useApp";
import { garageApi } from "@/api/garage";

export default function GarageSettings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const notifications = useSelector((state) => state.garage.notifications);
  const { garageToken, logoutGarage } = useApp();

  // State for expandable sections
  const [activeSection, setActiveSection] = useState(null);

  // State for password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // State for confirmation modals
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
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
      description: "Update your password",
      type: "form",
    },
    {
      id: "logout",
      icon: FiLogOut,
      title: "Logout",
      description: "Sign out of your account",
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

  // Handle notification toggle
  const handleNotificationToggle = (type, value) => {
    dispatch(setNotifications({ ...notifications, [type]: value }));
  };

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);

    // Validate passwords
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Passwords do not match!");
      setPasswordLoading(false);
      return;
    }
    if (!passwordForm.currentPassword) {
      setPasswordError("Current password is required!");
      setPasswordLoading(false);
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long!");
      setPasswordLoading(false);
      return;
    }

    try {
      await garageApi.changePassword(
        garageToken,
        passwordForm.currentPassword,
        passwordForm.newPassword,
      );
      setPasswordSuccess("Password changed successfully!");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(
        err.response?.data?.message ||
          err.message ||
          "Unable to change password",
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    setActionLoading(true);
    await logoutGarage();
    navigate("/garage/login");
  };

  // Handle delete account
  const handleDeleteAccount = async () => {
    setActionLoading(true);
    await logoutGarage();
    navigate("/");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted">Manage your account settings</p>
      </div>

      <div className="space-y-3">
        {settingsItems.map((item) => (
          <div key={item.id} className="card-soft">
            <button
              onClick={() => {
                if (item.type === "danger") {
                  if (item.id === "logout") setShowLogoutModal(true);
                  if (item.id === "delete") setShowDeleteModal(true);
                } else {
                  setActiveSection(activeSection === item.id ? null : item.id);
                }
              }}
              className="w-full p-6 text-left flex items-center justify-between hover:bg-bg-soft transition-colors rounded-2xl"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`p-3 rounded-xl ${
                    item.type === "danger"
                      ? "bg-red-100 text-red-700"
                      : "bg-bg-soft"
                  }`}
                >
                  <item.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3
                    className={`font-bold ${item.type === "danger" ? "text-red-700" : ""}`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-muted text-sm">{item.description}</p>
                </div>
              </div>
              {item.type !== "danger" &&
                (activeSection === item.id ? (
                  <FiChevronUp />
                ) : (
                  <FiChevronDown />
                ))}
            </button>

            {/* Notifications */}
            {item.id === "notifications" &&
              activeSection === "notifications" && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="p-6 pt-0 border-t border-line"
                >
                  <div className="flex items-center justify-between p-4 bg-bg-soft rounded-xl mb-4">
                    <div className="flex items-center gap-3">
                      <FiMessageSquare className="w-5 h-5 text-muted" />
                      <span>WhatsApp Notifications</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.whatsapp}
                      onChange={(e) =>
                        handleNotificationToggle("whatsapp", e.target.checked)
                      }
                      className="w-5 h-5 accent-emerald-500"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-bg-soft rounded-xl">
                    <div className="flex items-center gap-3">
                      <FiPhone className="w-5 h-5 text-muted" />
                      <span>SMS Notifications</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={notifications.sms}
                      onChange={(e) =>
                        handleNotificationToggle("sms", e.target.checked)
                      }
                      className="w-5 h-5 accent-emerald-500"
                    />
                  </div>
                </div>
              )}

            {/* Change Password */}
            {item.id === "password" && activeSection === "password" && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="p-6 pt-0 border-t border-line"
              >
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {passwordError && (
                    <div className="p-4 bg-red-100 text-red-700 rounded-xl flex items-center gap-2">
                      <FiX /> {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="p-4 bg-green-100 text-green-700 rounded-xl flex items-center gap-2">
                      <FiCheck /> {passwordSuccess}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          currentPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                      placeholder="Enter current password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          newPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                      placeholder="Enter new password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({
                          ...passwordForm,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 rounded-xl border border-line focus:border-ink focus:outline-none transition-colors"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="btn-primary w-full"
                  >
                    {passwordLoading
                      ? "Changing Password..."
                      : "Change Password"}
                  </button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiLogOut className="w-8 h-8 text-red-700" />
              </div>
              <h3 className="text-xl font-bold mb-2">Logout</h3>
              <p className="text-muted">Are you sure you want to log out?</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 btn-ghost"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 bg-red-700 text-white hover:bg-red-800 transition-colors px-4 py-3 rounded-xl"
                disabled={actionLoading}
              >
                {actionLoading ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiAlertTriangle className="w-8 h-8 text-red-700" />
              </div>
              <h3 className="text-xl font-bold mb-2">Delete Account</h3>
              <p className="text-muted">
                Are you sure you want to permanently delete your account? This
                action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 btn-ghost"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 bg-red-700 text-white hover:bg-red-800 transition-colors px-4 py-3 rounded-xl"
                disabled={actionLoading}
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
