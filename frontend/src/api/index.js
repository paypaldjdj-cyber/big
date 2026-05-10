import { localDB } from "./db";

export const BASE = "https://big-production-b648.up.railway.app/api";

async function req(path, method = "GET", body = null, isMultipart = false) {
  const isRead = method === "GET";
  
  // Helper for offline logic
  const handleOffline = () => {
    if (isRead) {
      const cached = localDB.get(path);
      if (cached) return cached;
    } else if (!path.includes("/auth/login")) {
      // Queue other writes, but NOT login
      localDB.enqueue(path, method, body, isMultipart);
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { message: "تم حفظ العملية أوفلاين", type: "info" } 
      }));
      return { status: "queued", offline: true };
    }
    throw new Error("Offline");
  };



  // 1. Initial Check
  if (!navigator.onLine) return handleOffline();

  // 2. Normal Online Request
  console.log(`API REQ: ${method} ${path}`, isMultipart ? "FORM_DATA" : body);
  let user = null;
  try { user = JSON.parse(localStorage.getItem("clinic_user") || "null"); } catch {}
  
  const headers = {
    "Authorization": user?.token ? `Bearer ${user.token}` : ""
  };
  
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }

  const opts = {
    method,
    headers,
  };

  if (body) {
    opts.body = isMultipart ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(BASE + path, opts);
    if (res.status === 401) {
      localStorage.removeItem("clinic_user");
      window.location.href = "#/?error=session_expired";
      throw new Error("Session expired");
    }

    const resText = await res.text();
    if (!res.ok) throw new Error(resText);
    
    const data = JSON.parse(resText);
    if (isRead) localDB.save(path, data);
    return data;
  } catch (err) {
    // Standardize network errors to trigger offline fallback
    if (err.name === 'TypeError' || err.message.includes('fetch')) {
      return handleOffline();
    }
    throw err;
  }
}



// Background Sync Function
export async function syncOfflineData() {
  if (!navigator.onLine) return;
  const queue = localDB.getQueue();
  if (queue.length === 0) return;

  console.log("ONLINE: Syncing offline data...", queue.length);
  window.dispatchEvent(new CustomEvent('show-toast', { 
    detail: { message: `جاري مزامنة ${queue.length} عمليات...`, type: "info" } 
  }));

  for (const item of queue) {
    try {
      await req(item.path, item.method, item.body, item.isMultipart);
      localDB.removeFromQueue(item.id);
    } catch (e) {
      console.error("Sync failed for item:", item, e);
    }
  }
  
  window.dispatchEvent(new CustomEvent('show-toast', { 
    detail: { message: "تمت المزامنة بنجاح ✅", type: "success" } 
  }));
}

// Auto-sync when coming online
window.addEventListener('online', syncOfflineData);
// Periodic sync check
setInterval(syncOfflineData, 60000); // Every minute


// Auth
export const login = (data) => req("/auth/login", "POST", data);
export const register = (data) => req("/auth/register", "POST", data);
export const getDoctors = () => req("/auth/doctors");
export const createDoctor = (data) => req("/auth/doctors", "POST", data);
export const updateDoctor = (id, data) => req(`/auth/doctors/${id}`, "PUT", data);
export const deleteDoctor = (id) => req(`/auth/doctors/${id}`, "DELETE");
export const getAdminSettings = () => req("/auth/admin/settings");
export const getAdminStats = () => req("/auth/admin/stats");
export const updateAdminSettings = (data) => req("/auth/admin/settings", "POST", data);
export const changePassword = (password) => req("/auth/change-password", "POST", { password });
export const getSecretarySettings = () => req("/auth/secretary");
export const updateSecretarySettings = (data) => req("/auth/secretary", "POST", data);

// Patients
export const getPatients = (q = "", status = "", date = "") => req(`/patients/?q=${q}&status=${status}&date=${date}`);
export const getPatient = (id) => req(`/patients/${id}`);
export const addPatient = (data) => req("/patients/", "POST", data);
export const updatePatient = (id, data) => req(`/patients/${id}`, "PUT", data);
export const deletePatient = (id) => req(`/patients/${id}`, "DELETE");

// Teeth & Medical
export const saveTeeth = (id, data) => req(`/patients/${id}/teeth`, "POST", data);
export const addPrescription = (id, data) => req(`/patients/${id}/prescriptions`, "POST", data);
export const uploadPrescription = (id, formData) => req(`/patients/${id}/prescriptions`, "POST", formData, true);
export const getAllPrescriptions = () => req("/patients/prescriptions/all");
export const deletePrescription = (id) => req(`/patients/prescriptions/${id}`, "DELETE");
export const updatePrescription = (id, data) => req(`/patients/prescriptions/${id}`, "PUT", data);

// Treatments
export const getAllTreatments = (date = "") => req(`/patients/treatments/all?date=${date}`);
export const addTreatment = (pid, data) => req(`/patients/${pid}/treatments`, "POST", data);
export const deleteTreatment = (tid) => req(`/patients/treatments/${tid}`, "DELETE");

// Appointments
export const getAppointments = (date = "") => req(`/appointments/?date=${date}`);
export const addAppointment = (data) => req("/appointments/", "POST", data);
export const updateAppointment = (id, data) => req(`/appointments/${id}`, "PUT", data);
export const deleteAppointment = (id) => req(`/appointments/${id}`, "DELETE");
export const sendReminders = () => req("/appointments/reminders/send", "POST");

// Finance & Invoices
export const getInvoices = (q = "", status = "", date = "") => req(`/invoices/?q=${q}&status=${status}&date=${date}`);
export const addInvoice = (data) => req("/invoices/", "POST", data);
export const payInvoice = (id, amount) => req(`/invoices/${id}/pay`, "POST", { amount });
export const getInvoiceSummary = () => req("/stats/invoices/summary");

// Expenses
export const getExpenses = (date = "") => req(`/expenses/?date=${date}`);
export const addExpense = (data) => req("/expenses/", "POST", data);
export const deleteExpense = (id) => req(`/expenses/${id}`, "DELETE");

// Stats & Settings
export const getStats = () => req("/stats/summary");
export const getFinancialStats = () => req("/stats/financial");
export const getDebts = () => req("/stats/debts");
export const getSettings = () => req("/settings/");
export const updateSettings = (data) => req("/settings/", "PUT", data);
export const getAuditLogs = (role = "", date = "") => req(`/settings/audit-logs?role=${role}&date=${date}`);

// Inventory
export const getInventory = () => req("/inventory/");
export const getLowStock = () => req("/inventory/");
export const addInventoryItem = (data) => req("/inventory/", "POST", data);
export const updateInventoryItem = (id, data) => req(`/inventory/${id}`, "PUT", data);
export const updateInventoryStock = (id, change) => req(`/inventory/${id}/stock`, "POST", { change });
export const deleteInventoryItem = (id) => req(`/inventory/${id}`, "DELETE");

// Drugs & Smart Prescriptions
export const getDrugs = (q = "") => req(`/drugs/?q=${q}`);
export const addDrug = (data) => req("/drugs/", "POST", data);
export const deleteDrug = (id) => req(`/drugs/${id}`, "DELETE");
export const updateDrug = (id, data) => req(`/drugs/${id}`, "PUT", data);
export const toggleFavoriteDrug = (id) => req(`/drugs/${id}/toggle-favorite`, "POST");
export const createSmartPrescription = (data) => req("/prescriptions/", "POST", data);
export const getPrescriptionPDFUrl = (id) => `${BASE}/prescriptions/${id}/pdf`;

// Internal Messages
export const getMessages = () => req("/messages/");
export const sendMessage = (content, image_url) => req("/messages/", "POST", { content, image_url });
export const markMessagesRead = () => req("/messages/mark-read", "POST");
export const uploadChatImage = (formData) => req("/messages/upload", "POST", formData, true);

// Settings Extras
export const getGoogleAuth = () => req("/settings/google-auth");
export const downloadBackup = () => `${BASE}/settings/backup`;
export const restoreBackup = (fd) => req("/settings/restore", "POST", fd, true);
export const uploadClinicLogo = (fd) => req("/settings/upload-logo", "POST", fd, true);
export const resetClinic = (pass) => req("/settings/reset", "POST", { password: pass });

// System Admin Backups
export const getAdminBackups = () => req("/auth/admin/backups");
export const getAdminBackupUrl = (username) => `${BASE}/auth/admin/backups/download/${username}`;
