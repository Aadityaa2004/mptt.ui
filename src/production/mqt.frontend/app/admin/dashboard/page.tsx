"use client";

import { useState, useEffect } from "react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import Navbar from "@/components/navbar/Navbar";
import { adminService } from "@/services/api/adminService";
import { Loader2, AlertCircle, Users, Server, Cpu, BarChart3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User, Pi, Device, Reading, SummaryStatistics, PaginatedResponse } from "@/types/admin";

type Tab = "overview" | "users" | "pis" | "devices" | "readings";

export default function AdminDashboardPage() {
  const { user, isLoading } = useRequireAuth("admin");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Overview data
  const [stats, setStats] = useState<SummaryStatistics | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [piCount, setPiCount] = useState(0);
  const [deviceCount, setDeviceCount] = useState(0);

  // Users data
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<string | null>(null);

  // PIs data
  const [pis, setPis] = useState<Pi[]>([]);
  const [selectedPi, setSelectedPi] = useState<Pi | null>(null);
  const [showPiForm, setShowPiForm] = useState(false);
  const [showDeletePiConfirm, setShowDeletePiConfirm] = useState<string | null>(null);
  const [piDevices, setPiDevices] = useState<Device[]>([]);

  // Devices data
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<{ piId: string; deviceId: number } | null>(null);
  const [showDeviceForm, setShowDeviceForm] = useState(false);
  const [showDeleteDeviceConfirm, setShowDeleteDeviceConfirm] = useState<{ piId: string; deviceId: number } | null>(null);

  // Readings data
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedPiForReadings, setSelectedPiForReadings] = useState<string>("");
  const [selectedDeviceForReadings, setSelectedDeviceForReadings] = useState<number | null>(null);

  // Form states
  const [userFormData, setUserFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "user" as "admin" | "user",
  });
  const [piFormData, setPiFormData] = useState({
    pi_id: "",
    user_id: "",
  });
  const [deviceFormData, setDeviceFormData] = useState({
    device_id: "",
  });

  useEffect(() => {
    if (!isLoading && user) {
      loadOverviewData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  useEffect(() => {
    if (activeTab === "overview") {
      loadOverviewData();
    } else if (activeTab === "users") {
      loadUsers();
    } else if (activeTab === "pis") {
      loadPis();
      // Load users for assignment dropdown
      if (users.length === 0) {
        adminService.getAllUsers()
          .then((data) => setUsers(data?.users || []))
          .catch((err) => {
            console.error("Error loading users for PI assignment:", err);
            setUsers([]);
          });
      }
    } else if (activeTab === "devices" && selectedPi) {
      loadDevices(selectedPi.pi_id);
    } else if (activeTab === "readings") {
      // Load PIs for the dropdown
      if (pis.length === 0) {
        loadPis();
      }
      if (selectedPiForReadings) {
        // Load devices for the selected PI
        adminService.getDevices(selectedPiForReadings)
          .then((data) => setDevices(data?.items || []))
          .catch((err) => {
            console.error("Error loading devices for readings:", err);
            setDevices([]);
          });
        loadReadings();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedPi, selectedPiForReadings, selectedDeviceForReadings]);

  const loadOverviewData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch all users
      const usersData = await adminService.getAllUsers().catch(() => ({ users: [] }));
      setUserCount(usersData?.users?.length || 0);
      
      // Fetch all PIs with a large page size to get accurate count
      const pisData = await adminService.getAllPis(undefined, 1, 1000).catch(() => ({ items: [], total: 0, page: 1, page_size: 1000 }));
      const piCount = pisData?.total || pisData?.items?.length || 0;
      setPiCount(piCount);
      
      // Fetch stats
      const statsData = await adminService.getSummaryStats().catch(() => null);
      setStats(statsData);
      
      // Calculate total device count by summing devices from all PIs
      let totalDevices = 0;
      if (pisData?.items && pisData.items.length > 0) {
        try {
          const deviceCounts = await Promise.all(
            pisData.items.map(async (pi) => {
              try {
                // Fetch all devices for this PI by using a large page size
                const devicesData = await adminService.getDevices(pi.pi_id, 1, 1000);
                // Handle both response formats: {total, items} or {items, next_page}
                const response = devicesData as PaginatedResponse<Device> & { next_page?: number | null };
                if (response?.total !== undefined) {
                  return response.total;
                } else if (response?.items) {
                  // If no total field, count items and check if there are more pages
                  let count = response.items.length;
                  let currentPage = 1;
                  let hasNextPage = response.next_page !== undefined && response.next_page !== null;
                  
                  // Fetch remaining pages if next_page exists
                  while (hasNextPage) {
                    currentPage++;
                    try {
                      const nextPageData = await adminService.getDevices(pi.pi_id, currentPage, 1000) as PaginatedResponse<Device> & { next_page?: number | null };
                      if (nextPageData?.items) {
                        count += nextPageData.items.length;
                        hasNextPage = nextPageData.next_page !== undefined && nextPageData.next_page !== null;
                      } else {
                        hasNextPage = false;
                      }
                    } catch {
                      hasNextPage = false;
                    }
                  }
                  return count;
                }
                return 0;
              } catch (err) {
                console.error(`Error counting devices for PI ${pi.pi_id}:`, err);
                return 0;
              }
            })
          );
          totalDevices = deviceCounts.reduce((sum, count) => sum + count, 0);
        } catch (err) {
          console.error("Error counting devices:", err);
          totalDevices = 0;
        }
      }
      setDeviceCount(totalDevices);
      
      console.log("Overview data loaded:", {
        users: usersData?.users?.length || 0,
        pis: piCount,
        devices: totalDevices,
        pisData: pisData
      });
    } catch (err) {
      console.error("Error loading overview data:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAllUsers();
      setUsers(data?.users || []);
    } catch (err) {
      console.error("Error loading users:", err);
      setError(err instanceof Error ? err.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPis = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getAllPis();
      setPis(data?.items || []);
    } catch (err) {
      console.error("Error loading PIs:", err);
      setError(err instanceof Error ? err.message : "Failed to load PIs");
      setPis([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async (piId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await adminService.getDevices(piId);
      const items = data?.items || [];
      setPiDevices(items);
      setDevices(items);
    } catch (err) {
      console.error("Error loading devices:", err);
      setError(err instanceof Error ? err.message : "Failed to load devices");
      setPiDevices([]);
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReadings = async () => {
    try {
      setLoading(true);
      setError(null);
      if (selectedDeviceForReadings !== null) {
        const data = await adminService.getDeviceReadings(selectedPiForReadings, selectedDeviceForReadings);
        setReadings(data?.items || []);
      } else {
        const data = await adminService.getReadings({ pi_id: selectedPiForReadings });
        setReadings(data?.items || []);
      }
    } catch (err) {
      console.error("Error loading readings:", err);
      setError(err instanceof Error ? err.message : "Failed to load readings");
      setReadings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setLoading(true);
      setError(null);
      await adminService.registerAdmin(userFormData);
      setShowUserForm(false);
      setUserFormData({ username: "", email: "", password: "", role: "user" });
      await loadUsers();
      // Refresh overview statistics
      if (activeTab === "overview") {
        await loadOverviewData();
      }
    } catch (err) {
      console.error("Error creating user:", err);
      setError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: "admin" | "user") => {
    try {
      setLoading(true);
      setError(null);
      await adminService.updateUserRole(userId, role);
      await loadUsers();
    } catch (err) {
      console.error("Error updating user role:", err);
      setError(err instanceof Error ? err.message : "Failed to update user role");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await adminService.deleteUser(userId);
      setShowDeleteUserConfirm(null);
      await loadUsers();
      // Refresh overview statistics
      if (activeTab === "overview") {
        await loadOverviewData();
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      setError(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePi = async () => {
    try {
      setLoading(true);
      setError(null);
      // Ensure users are loaded
      if (users.length === 0) {
        const usersData = await adminService.getAllUsers();
        setUsers(usersData.users);
      }
      await adminService.createPi({
        pi_id: piFormData.pi_id,
        user_id: piFormData.user_id || undefined,
      });
      setShowPiForm(false);
      setPiFormData({ pi_id: "", user_id: "" });
      await loadPis();
      // Refresh overview statistics
      if (activeTab === "overview") {
        await loadOverviewData();
      }
    } catch (err) {
      console.error("Error creating PI:", err);
      setError(err instanceof Error ? err.message : "Failed to create PI");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePi = async (piId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      // Ensure users are loaded
      if (users.length === 0) {
        const usersData = await adminService.getAllUsers();
        setUsers(usersData.users);
      }
      await adminService.updatePi(piId, { user_id: userId || undefined });
      await loadPis();
    } catch (err) {
      console.error("Error updating PI:", err);
      setError(err instanceof Error ? err.message : "Failed to update PI");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePi = async (piId: string) => {
    try {
      setLoading(true);
      setError(null);
      await adminService.deletePi(piId, true);
      setShowDeletePiConfirm(null);
      await loadPis();
      // Refresh overview statistics
      if (activeTab === "overview") {
        await loadOverviewData();
      }
    } catch (err) {
      console.error("Error deleting PI:", err);
      setError(err instanceof Error ? err.message : "Failed to delete PI");
    } finally {
      setLoading(false);
    }
  };

  // Validate MAC address format (e.g., AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF)
  const isValidMACAddress = (mac: string): boolean => {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  };

  // Convert MAC address to a number (for backend compatibility)
  const macAddressToNumber = (mac: string): number => {
    // Remove colons and dashes, convert hex to decimal
    const hexString = mac.replace(/[:-]/g, "");
    // Convert hex to decimal, but limit to safe integer range
    // Use modulo to keep it within reasonable range
    const decimal = parseInt(hexString, 16);
    // Use modulo to keep it within JavaScript safe integer range, but still unique
    return decimal % Number.MAX_SAFE_INTEGER;
  };

  // Validate if device_id is either a number or text (MAC address format or any text)
  const isValidDeviceId = (id: string): boolean => {
    if (!id || !id.trim()) return false;
    const trimmedId = id.trim();
    // Check if it's a valid number
    if (!isNaN(Number(trimmedId)) && Number(trimmedId) > 0) return true;
    // Check if it's a valid MAC address format (with colons or dashes)
    if (isValidMACAddress(trimmedId)) return true;
    // Allow any non-empty text string (backend accepts text format)
    // Just ensure it has some content
    return trimmedId.length > 0;
  };

  const handleCreateDevice = async () => {
    if (!selectedPi) return;
    
    // Validate form data
    if (!deviceFormData.device_id || !isValidDeviceId(deviceFormData.device_id)) {
      setError("Device ID is required and must be a valid number or MAC address (e.g., AA:BB:CC:DD:EE:FF)");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Send device_id as-is: can be MAC address string (e.g., "AA:BB:CC:DD:EE:FF") or number
      let deviceId: string | number;
      if (!isNaN(Number(deviceFormData.device_id)) && !deviceFormData.device_id.includes(":") && !deviceFormData.device_id.includes("-")) {
        // It's a plain number, convert to number type
        deviceId = Number(deviceFormData.device_id);
      } else {
        // It's a MAC address or other text format, send as string
        deviceId = deviceFormData.device_id.trim();
      }
      
      await adminService.createDevice(selectedPi.pi_id, {
        device_id: deviceId,
      });
      setShowDeviceForm(false);
      setDeviceFormData({ 
        device_id: "", 
      });
      await loadDevices(selectedPi.pi_id);
      // Refresh overview statistics
      if (activeTab === "overview") {
        await loadOverviewData();
      }
    } catch (err) {
      console.error("Error creating device:", err);
      setError(err instanceof Error ? err.message : "Failed to create device");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDevice = async (piId: string, deviceId: number) => {
    try {
      setLoading(true);
      setError(null);
      await adminService.updateDevice(piId, deviceId, {});
      await loadDevices(piId);
    } catch (err) {
      console.error("Error updating device:", err);
      setError(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (piId: string, deviceId: number) => {
    try {
      setLoading(true);
      setError(null);
      await adminService.deleteDevice(piId, deviceId, true);
      setShowDeleteDeviceConfirm(null);
      await loadDevices(piId);
      // Refresh overview statistics
      if (activeTab === "overview") {
        await loadOverviewData();
      }
    } catch (err) {
      console.error("Error deleting device:", err);
      setError(err instanceof Error ? err.message : "Failed to delete device");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
          <p className="text-white/60 font-light">Loading...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "users", label: "Users", icon: <Users className="h-4 w-4" /> },
    { id: "pis", label: "PIs", icon: <Server className="h-4 w-4" /> },
    { id: "devices", label: "Devices", icon: <Cpu className="h-4 w-4" /> },
    { id: "readings", label: "Readings", icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="pt-24 px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-light tracking-tight mb-2">Dashboard</h1>
            {/* <p className="text-white/60 font-light text-sm">Manage users, PIs, devices, and system settings</p> */}
          </div>

          {error && (
            <div className="mb-6 p-4 border border-red-500/20 bg-red-500/10 rounded-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <p className="text-sm text-red-400 font-light">{error}</p>
            </div>
          )}

          {/* Tabs */}
          <div className="border-b border-white/10 mb-6">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError(null);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors font-light ${
                    activeTab === tab.id
                      ? "border-white text-white"
                      : "border-transparent text-white/60 hover:text-white/80"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-white/60 animate-spin" />
            </div>
          )}

          {!loading && activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-white/10 rounded-lg p-6 bg-black/50">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-5 w-5 text-white/60" />
                  <h3 className="text-lg font-light">Total Users</h3>
                </div>
                <p className="text-3xl font-light">{userCount}</p>
              </div>
              <div className="border border-white/10 rounded-lg p-6 bg-black/50">
                <div className="flex items-center gap-3 mb-2">
                  <Server className="h-5 w-5 text-white/60" />
                  <h3 className="text-lg font-light">Total PIs</h3>
                </div>
                <p className="text-3xl font-light">{piCount}</p>
              </div>
              <div className="border border-white/10 rounded-lg p-6 bg-black/50">
                <div className="flex items-center gap-3 mb-2">
                  <Cpu className="h-5 w-5 text-white/60" />
                  <h3 className="text-lg font-light">Total Devices</h3>
                </div>
                <p className="text-3xl font-light">{deviceCount}</p>
              </div>
              {stats && (
                <div className="border border-white/10 rounded-lg p-6 bg-black/50 md:col-span-3">
                  <h3 className="text-lg font-light mb-4">Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-white/60 text-sm font-light">Total Readings</p>
                      <p className="text-2xl font-light">{stats.total_readings}</p>
                    </div>
                    {stats.avg_temperature !== undefined && (
                      <div>
                        <p className="text-white/60 text-sm font-light">Avg Temperature</p>
                        <p className="text-2xl font-light">{stats.avg_temperature.toFixed(1)}°C</p>
                      </div>
                    )}
                    {stats.avg_humidity !== undefined && (
                      <div>
                        <p className="text-white/60 text-sm font-light">Avg Humidity</p>
                        <p className="text-2xl font-light">{stats.avg_humidity.toFixed(1)}%</p>
                      </div>
                    )}
                    {stats.min_temperature !== undefined && stats.max_temperature !== undefined && (
                      <div>
                        <p className="text-white/60 text-sm font-light">Temp Range</p>
                        <p className="text-2xl font-light">
                          {stats.min_temperature.toFixed(1)}° - {stats.max_temperature.toFixed(1)}°
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "users" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-light">User Management</h2>
                <Button onClick={() => setShowUserForm(true)}>Create User</Button>
              </div>

              {showUserForm && (
                <div className="border border-white/10 rounded-lg p-6 bg-black/50 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-light">Create New User</h3>
                    <button onClick={() => setShowUserForm(false)} className="text-white/60 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="Username"
                      value={userFormData.username}
                      onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                      className="bg-black/50 border-white/10"
                    />
                    <Input
                      type="email"
                      placeholder="Email"
                      value={userFormData.email}
                      onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                      className="bg-black/50 border-white/10"
                    />
                    <Input
                      type="password"
                      placeholder="Password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                      className="bg-black/50 border-white/10"
                    />
                    <select
                      value={userFormData.role}
                      onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as "admin" | "user" })}
                      className="flex h-9 w-full rounded-md border border-white bg-black px-3 py-1 text-sm"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleCreateUser}>Create</Button>
                    <Button variant="outline" onClick={() => setShowUserForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-black/50 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-light">Username</th>
                      <th className="px-4 py-3 text-left text-sm font-light">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-light">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-light">Active</th>
                      <th className="px-4 py-3 text-left text-sm font-light">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(users || []).map((u) => (
                      <tr key={u.user_id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3 text-sm font-light">{u.username}</td>
                        <td className="px-4 py-3 text-sm font-light">{u.email}</td>
                        <td className="px-4 py-3 text-sm font-light">
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateUserRole(u.user_id, e.target.value as "admin" | "user")}
                            className="bg-black border border-white rounded px-2 py-1 text-sm"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm font-light">{u.active ? "Yes" : "No"}</td>
                        <td className="px-4 py-3 text-sm font-light">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteUserConfirm(u.user_id)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showDeleteUserConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-black border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
                    <h3 className="text-lg font-light mb-4">Confirm Delete</h3>
                    <p className="text-white/60 font-light mb-6">
                      Are you sure you want to delete this user? This action cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={() => handleDeleteUser(showDeleteUserConfirm)}>
                        Delete
                      </Button>
                      <Button variant="outline" onClick={() => setShowDeleteUserConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "pis" && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-light">PI Management</h2>
                <Button onClick={() => setShowPiForm(true)}>Create PI</Button>
              </div>

              {showPiForm && (
                <div className="border border-white/10 rounded-lg p-6 bg-black/50 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-light">Create New PI</h3>
                    <button onClick={() => setShowPiForm(false)} className="text-white/60 hover:text-white">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      placeholder="PI ID"
                      value={piFormData.pi_id}
                      onChange={(e) => setPiFormData({ ...piFormData, pi_id: e.target.value })}
                      className="bg-black/50 border-white/10"
                    />
                    <select
                      value={piFormData.user_id}
                      onChange={(e) => setPiFormData({ ...piFormData, user_id: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-white bg-black px-3 py-1 text-sm"
                    >
                      <option value="">No User (Unassigned)</option>
                      {(users || []).map((u) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleCreatePi}>Create</Button>
                    <Button variant="outline" onClick={() => setShowPiForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="border border-white/10 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-black/50 border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-light">PI ID</th>
                      <th className="px-4 py-3 text-left text-sm font-light">User</th>
                      <th className="px-4 py-3 text-left text-sm font-light">Created</th>
                      <th className="px-4 py-3 text-left text-sm font-light">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pis || []).map((pi) => (
                      <tr key={pi.pi_id} className="border-b border-white/10 hover:bg-white/5">
                        <td className="px-4 py-3 text-sm font-light">{pi.pi_id}</td>
                        <td className="px-4 py-3 text-sm font-light">
                          <select
                            value={pi.user_id || ""}
                            onChange={(e) => handleUpdatePi(pi.pi_id, e.target.value)}
                            className="bg-black border border-white rounded px-2 py-1 text-sm"
                          >
                            <option value="">Unassigned</option>
                            {(users || []).map((u) => (
                              <option key={u.user_id} value={u.user_id}>
                                {u.username}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm font-light">
                          {new Date(pi.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-light">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-black bg-white/90 border-2 border-white hover:bg-white/20 hover:border-white/30 text-xs font-light h-8 px-4  flex items-center gap-1.5"
                              onClick={() => {
                                setSelectedPi(pi);
                                setActiveTab("devices");
                              }}
                            >
                              View Devices
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setShowDeletePiConfirm(pi.pi_id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showDeletePiConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-black border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
                    <h3 className="text-lg font-light mb-4">Confirm Delete</h3>
                    <p className="text-white/60 font-light mb-6">
                      Are you sure you want to delete this PI? This will also delete all associated devices and readings (cascade delete).
                    </p>
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={() => handleDeletePi(showDeletePiConfirm)}>
                        Delete
                      </Button>
                      <Button variant="outline" onClick={() => setShowDeletePiConfirm(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === "devices" && (
            <div>
              {!selectedPi ? (
                <div className="border border-white/10 rounded-lg p-6 bg-black/50 text-center">
                  <p className="text-white/60 font-light mb-4">Select a PI to view its devices</p>
                  <Button onClick={() => setActiveTab("pis")}>Go to PIs</Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-2xl font-light">Device Management</h2>
                      <p className="text-white/60 font-light text-sm mt-1">PI: {selectedPi.pi_id}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setSelectedPi(null)}>Back to PIs</Button>
                      <Button onClick={() => setShowDeviceForm(true)}>Create Device</Button>
                    </div>
                  </div>

                  {showDeviceForm && (
                    <div className="border border-white/10 rounded-lg p-6 bg-black/50 mb-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-light">Create New Device</h3>
                        <button onClick={() => setShowDeviceForm(false)} className="text-white/60 hover:text-white">
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                      <div>
                        <label className="text-sm text-white/60 font-light mb-1 block">Device ID</label>
                        <Input
                          placeholder="Number (e.g., 1) or MAC Address (e.g., AA:BB:CC:DD:EE:FF)"
                          value={deviceFormData.device_id}
                          onChange={(e) => setDeviceFormData({ ...deviceFormData, device_id: e.target.value })}
                          className="bg-black/50 border-white/10"
                        />
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button 
                          onClick={handleCreateDevice}
                          disabled={!deviceFormData.device_id || !isValidDeviceId(deviceFormData.device_id)}
                        >
                          Create
                        </Button>
                        <Button variant="outline" onClick={() => setShowDeviceForm(false)}>Cancel</Button>
                      </div>
                    </div>
                  )}

                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-black/50 border-b border-white/10">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-light">Device ID</th>
                          <th className="px-4 py-3 text-left text-sm font-light">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(piDevices || []).map((device) => (
                          <tr key={`${device.pi_id}-${device.device_id}`} className="border-b border-white/10 hover:bg-white/5">
                            <td className="px-4 py-3 text-sm font-light">{device.device_id}</td>
                            <td className="px-4 py-3 text-sm font-light">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  setShowDeleteDeviceConfirm({ piId: device.pi_id, deviceId: device.device_id })
                                }
                              >
                                Delete
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {showDeleteDeviceConfirm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <div className="bg-black border border-white/10 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-light mb-4">Confirm Delete</h3>
                        <p className="text-white/60 font-light mb-6">
                          Are you sure you want to delete this device? This will also delete all associated readings (cascade delete).
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="destructive"
                            onClick={() =>
                              handleDeleteDevice(showDeleteDeviceConfirm.piId, showDeleteDeviceConfirm.deviceId)
                            }
                          >
                            Delete
                          </Button>
                          <Button variant="outline" onClick={() => setShowDeleteDeviceConfirm(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!loading && activeTab === "readings" && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-light mb-4">Reading Management</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <select
                    value={selectedPiForReadings}
                    onChange={(e) => {
                      setSelectedPiForReadings(e.target.value);
                      setSelectedDeviceForReadings(null);
                    }}
                    className="flex h-9 w-full rounded-md border border-white bg-black px-3 py-1 text-sm"
                  >
                    <option value="">Select PI</option>
                    {(pis || []).map((pi) => (
                      <option key={pi.pi_id} value={pi.pi_id}>
                        {pi.pi_id}
                      </option>
                    ))}
                  </select>
                  {selectedPiForReadings && (
                    <select
                      value={selectedDeviceForReadings || ""}
                      onChange={(e) => {
                        const deviceId = e.target.value ? parseInt(e.target.value) : null;
                        setSelectedDeviceForReadings(deviceId);
                      }}
                      className="flex h-9 w-full rounded-md border border-white bg-black px-3 py-1 text-sm"
                    >
                      <option value="">All Devices</option>
                      {(devices || [])
                        .filter((d) => d.pi_id === selectedPiForReadings)
                        .map((device) => (
                          <option key={device.device_id} value={device.device_id}>
                            Device {device.device_id}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              {selectedPiForReadings && (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-black/50 border-b border-white/10">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-light">Timestamp</th>
                        <th className="px-4 py-3 text-left text-sm font-light">Device ID</th>
                        <th className="px-4 py-3 text-left text-sm font-light">Temperature</th>
                        <th className="px-4 py-3 text-left text-sm font-light">Level</th>
                        <th className="px-4 py-3 text-left text-sm font-light">Battery</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(readings || []).map((reading, idx) => (
                        <tr key={idx} className="border-b border-white/10 hover:bg-white/5">
                          <td className="px-4 py-3 text-sm font-light">
                            {new Date(reading.ts).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-light">{reading.device_id}</td>
                          <td className="px-4 py-3 text-sm font-light">
                            {reading.payload.sensors.temperature
                              ? `${reading.payload.sensors.temperature.value} ${reading.payload.sensors.temperature.unit}`
                              : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm font-light">
                            {reading.payload.sensors.level
                              ? `${reading.payload.sensors.level.value} ${reading.payload.sensors.level.unit}`
                              : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-sm font-light">
                            {reading.payload.battery_percentage}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {readings.length === 0 && (
                    <div className="p-8 text-center text-white/60 font-light">
                      No readings found for the selected filters.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
