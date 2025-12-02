import { apiFetch } from "@/services/api/apiClient";
import type {
  User,
  Pi,
  Device,
  Reading,
  PaginatedResponse,
  SummaryStatistics,
  CreatePiRequest,
  UpdatePiRequest,
  CreateDeviceRequest,
  UpdateDeviceRequest,
  UpdateUserRequest,
  UpdateUserRoleRequest,
  RegisterAdminRequest,
  GetReadingsParams,
  GetDeviceReadingsParams,
  GetStatsParams,
} from "@/types/admin";

// User Management
export const adminService = {
  // User Management
  async getAllUsers(): Promise<{ users: User[] }> {
    const response = await apiFetch("/api/users");
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch users" }));
      throw new Error(error.error || "Failed to fetch users");
    }
    return response.json();
  },

  async getUserById(id: string): Promise<User> {
    const response = await apiFetch(`/api/users/${id}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch user" }));
      throw new Error(error.error || "Failed to fetch user");
    }
    return response.json();
  },

  async updateUser(id: string, updates: UpdateUserRequest): Promise<User> {
    const response = await apiFetch(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to update user" }));
      throw new Error(error.error || "Failed to update user");
    }
    return response.json();
  },

  async deleteUser(id: string): Promise<{ message: string }> {
    const response = await apiFetch(`/api/users/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to delete user" }));
      throw new Error(error.error || "Failed to delete user");
    }
    return response.json();
  },

  async updateUserRole(id: string, role: "admin" | "user"): Promise<User> {
    const response = await apiFetch(`/api/users/${id}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to update user role" }));
      throw new Error(error.error || "Failed to update user role");
    }
    return response.json();
  },

  async registerAdmin(userData: RegisterAdminRequest): Promise<User> {
    const response = await apiFetch("/api/auth/register/admin", {
      method: "POST",
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to register admin" }));
      throw new Error(error.error || "Failed to register admin");
    }
    return response.json();
  },

  // PI Management
  async createPi(piData: CreatePiRequest): Promise<Pi> {
    const response = await apiFetch("/pis", {
      method: "POST",
      body: JSON.stringify(piData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to create PI" }));
      throw new Error(error.error || "Failed to create PI");
    }
    return response.json();
  },

  async getAllPis(userId?: string, page = 1, pageSize = 10): Promise<PaginatedResponse<Pi>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    if (userId) params.append("user_id", userId);
    const response = await apiFetch(`/pis?${params}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch PIs" }));
      throw new Error(error.error || "Failed to fetch PIs");
    }
    return response.json();
  },

  async getPiById(piId: string): Promise<Pi> {
    const response = await apiFetch(`/pis/${piId}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch PI" }));
      throw new Error(error.error || "Failed to fetch PI");
    }
    return response.json();
  },

  async updatePi(piId: string, updates: UpdatePiRequest): Promise<Pi> {
    const response = await apiFetch(`/pis/${piId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to update PI" }));
      throw new Error(error.error || "Failed to update PI");
    }
    return response.json();
  },

  async deletePi(piId: string, cascade = false): Promise<{ deleted: boolean }> {
    const params = cascade ? "?cascade=true" : "";
    const response = await apiFetch(`/pis/${piId}${params}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to delete PI" }));
      throw new Error(error.error || "Failed to delete PI");
    }
    return response.json();
  },

  // Device Management
  async createDevice(piId: string, deviceData: CreateDeviceRequest): Promise<Device> {
    // Validate input
    if (deviceData.device_id === undefined || deviceData.device_id === null || deviceData.device_id === "") {
      throw new Error("Device ID is required");
    }
    
    // Send device_id as-is (can be string for MAC addresses or number)
    const requestBody: Record<string, unknown> = {
      device_id: deviceData.device_id,
    };
    
    const response = await apiFetch(`/pis/${piId}/devices`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to create device" }));
      throw new Error(error.error || "Failed to create device");
    }
    return response.json();
  },

  async getDevices(piId: string, page = 1, pageSize = 10): Promise<PaginatedResponse<Device>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    const response = await apiFetch(`/pis/${piId}/devices?${params}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch devices" }));
      throw new Error(error.error || "Failed to fetch devices");
    }
    return response.json();
  },

  async getDevice(piId: string, deviceId: number): Promise<Device> {
    const response = await apiFetch(`/pis/${piId}/devices/${deviceId}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch device" }));
      throw new Error(error.error || "Failed to fetch device");
    }
    return response.json();
  },

  async updateDevice(
    piId: string,
    deviceId: number,
    updates: UpdateDeviceRequest
  ): Promise<Device> {
    // Device updates not currently supported by backend
    const requestBody: Record<string, unknown> = {};
    const response = await apiFetch(`/pis/${piId}/devices/${deviceId}`, {
      method: "PATCH",
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to update device" }));
      throw new Error(error.error || "Failed to update device");
    }
    return response.json();
  },

  async deleteDevice(piId: string, deviceId: number, cascade = false): Promise<{ deleted: boolean }> {
    const params = cascade ? "?cascade=true" : "";
    const response = await apiFetch(`/pis/${piId}/devices/${deviceId}${params}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to delete device" }));
      throw new Error(error.error || "Failed to delete device");
    }
    return response.json();
  },

  // Reading Management
  async getLatestReadings(piId: string): Promise<{ items: Reading[] }> {
    const response = await apiFetch(`/readings/latest?pi_id=${piId}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch latest readings" }));
      throw new Error(error.error || "Failed to fetch latest readings");
    }
    return response.json();
  },

  async getReadings(params: GetReadingsParams): Promise<PaginatedResponse<Reading>> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) queryParams.append(key, value.toString());
    });
    const response = await apiFetch(`/readings?${queryParams}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch readings" }));
      throw new Error(error.error || "Failed to fetch readings");
    }
    return response.json();
  },

  async getDeviceReadings(
    piId: string,
    deviceId: number,
    params?: GetDeviceReadingsParams
  ): Promise<PaginatedResponse<Reading>> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    const url = `/readings/pis/${piId}/devices/${deviceId}${queryParams.toString() ? `?${queryParams}` : ""}`;
    const response = await apiFetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch device readings" }));
      throw new Error(error.error || "Failed to fetch device readings");
    }
    return response.json();
  },

  // Statistics
  async getSummaryStats(params?: GetStatsParams): Promise<SummaryStatistics> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value);
      });
    }
    const url = `/stats/summary${queryParams.toString() ? `?${queryParams}` : ""}`;
    const response = await apiFetch(url);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to fetch statistics" }));
      throw new Error(error.error || "Failed to fetch statistics");
    }
    return response.json();
  },
};

