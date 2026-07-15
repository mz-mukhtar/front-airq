"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminRouteGuard } from "@/components/AdminRouteGuard";
import { AppShell } from "@/components/layout/AppShell";
import { LoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Users,
  MapPin,
  Database,
  Plus,
  Edit,
  Trash2,
  Shield,
  X,
  Key,
  Copy,
  Check,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} from "@/lib/api/users";
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  parseLocationDeleteConflict,
} from "@/lib/api/locations";
import {
  getSensorDevices,
  createSensorDevice,
  updateSensorDevice,
  deleteSensorDevice,
  regenerateDeviceApiKey,
  updateDeviceApproval,
  bulkUpdateSensorDevices,
} from "@/lib/api/sensor-devices";
import {
  User,
  Location,
  SensorDevice,
  UserAdminCreate,
  UserAdminUpdate,
  CreateLocationRequest,
  UpdateLocationRequest,
  LocationDeleteConflictDetail,
  CreateSensorDeviceRequest,
  UpdateSensorDeviceRequest,
  BulkDeviceUpdateItem,
} from "@/lib/api/types";

type TabType = "users" | "locations" | "devices";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [devices, setDevices] = useState<SensorDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // User management state
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserAdminCreate>({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");

  // Location management state
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState<CreateLocationRequest>({
    name: "",
    latitude: 0,
    longitude: 0,
    description: "",
  });

  // Device management state
  const [deviceDialogOpen, setDeviceDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<SensorDevice | null>(null);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [apiKeyDialogDeviceName, setApiKeyDialogDeviceName] = useState("");
  const [apiKeyDialogDeviceId, setApiKeyDialogDeviceId] = useState("");
  const [apiKeyDialogKey, setApiKeyDialogKey] = useState("");
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [deviceIdCopied, setDeviceIdCopied] = useState(false);
  const [regeneratingDeviceId, setRegeneratingDeviceId] = useState<string | null>(null);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const [regenerateConfirmDevice, setRegenerateConfirmDevice] = useState<SensorDevice | null>(null);
  const [locationDeleteConfirmOpen, setLocationDeleteConfirmOpen] = useState(false);
  const [locationDeleteTarget, setLocationDeleteTarget] = useState<Location | null>(null);
  const [locationDeleteConflict, setLocationDeleteConflict] =
    useState<LocationDeleteConflictDetail | null>(null);
  const [locationDeleteLoading, setLocationDeleteLoading] = useState(false);
  const [deviceForm, setDeviceForm] = useState<CreateSensorDeviceRequest>({
    location_id: "",
    who_deployed_it: "source",
    serial_number: "",
    status: "active",
    metadata_json: {},
  });
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<"active" | "offline" | "maintenance">("active");
  const [bulkLocationDialogOpen, setBulkLocationDialogOpen] = useState(false);
  const [bulkLocationId, setBulkLocationId] = useState<string>("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const refreshUser = useAuthStore((state) => state.refreshUser);
  const router = useRouter();

  useEffect(() => {
    setSelectedDevices(new Set());
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "users") {
        const data = await getUsers();
        setUsers(data);
      } else if (activeTab === "locations") {
        const data = await getLocations();
        setLocations(data);
      } else if (activeTab === "devices") {
        const [devicesData, locationsData] = await Promise.all([
          getSensorDevices(),
          getLocations(),
        ]);
        setDevices(devicesData);
        setLocations(locationsData);
        setSelectedDevices(new Set());
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch data");
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  // User management functions
  const handleCreateUser = async () => {
    try {
      await createUser(userForm);
      setUserDialogOpen(false);
      resetUserForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to create user");
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const updateData: UserAdminUpdate = {
        name: userForm.name,
        email: userForm.email,
        role: userForm.role,
      };
      await updateUser(editingUser.id, updateData);
      setUserDialogOpen(false);
      setEditingUser(null);
      resetUserForm();
      fetchData();
      await refreshUser();
    } catch (err: any) {
      setError(err.message || "Failed to update user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await deleteUser(userId);
      fetchData();
      await refreshUser();
    } catch (err: any) {
      setError(err.message || "Failed to delete user");
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !newPassword) return;
    try {
      await resetUserPassword(resetPasswordUserId, newPassword);
      setResetPasswordDialogOpen(false);
      setResetPasswordUserId("");
      setNewPassword("");
      alert("Password reset successfully");
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    }
  };

  const openUserDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        email: user.email,
        password: "",
        role: user.role,
      });
    } else {
      setEditingUser(null);
      resetUserForm();
    }
    setUserDialogOpen(true);
  };

  const resetUserForm = () => {
    setUserForm({
      name: "",
      email: "",
      password: "",
      role: "user",
    });
  };

  // Location management functions
  const handleCreateLocation = async () => {
    try {
      await createLocation(locationForm);
      setLocationDialogOpen(false);
      resetLocationForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to create location");
    }
  };

  const handleUpdateLocation = async () => {
    if (!editingLocation) return;
    try {
      const updateData: UpdateLocationRequest = {
        name: locationForm.name,
        latitude: locationForm.latitude,
        longitude: locationForm.longitude,
        description: locationForm.description,
      };
      await updateLocation(editingLocation.id, updateData);
      setLocationDialogOpen(false);
      setEditingLocation(null);
      resetLocationForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to update location");
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    setError(null);
    setLocationDeleteLoading(true);
    try {
      await deleteLocation(location.id);
      fetchData();
    } catch (err: unknown) {
      const conflict = parseLocationDeleteConflict(err);
      if (conflict?.requires_cascade) {
        setLocationDeleteTarget(location);
        setLocationDeleteConflict(conflict);
        setLocationDeleteConfirmOpen(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to delete location");
      }
    } finally {
      setLocationDeleteLoading(false);
    }
  };

  const handleConfirmCascadeDeleteLocation = async () => {
    if (!locationDeleteTarget) return;
    setError(null);
    setLocationDeleteLoading(true);
    try {
      await deleteLocation(locationDeleteTarget.id, { cascade: true });
      setLocationDeleteConfirmOpen(false);
      setLocationDeleteTarget(null);
      setLocationDeleteConflict(null);
      fetchData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete location");
    } finally {
      setLocationDeleteLoading(false);
    }
  };

  const closeLocationDeleteConfirm = () => {
    setLocationDeleteConfirmOpen(false);
    setLocationDeleteTarget(null);
    setLocationDeleteConflict(null);
  };

  const openLocationDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      setLocationForm({
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        description: location.description || "",
      });
    } else {
      setEditingLocation(null);
      resetLocationForm();
    }
    setLocationDialogOpen(true);
  };

  const resetLocationForm = () => {
    setLocationForm({
      name: "",
      latitude: 0,
      longitude: 0,
      description: "",
    });
  };

  // Device management functions
  const handleCreateDevice = async () => {
    try {
      const created = await createSensorDevice(deviceForm);
      setDeviceDialogOpen(false);
      resetDeviceForm();
      // Show the one-time plaintext API key (same dialog as key regeneration)
      setApiKeyDialogDeviceName(created.serial_number);
      setApiKeyDialogDeviceId(created.id);
      setApiKeyDialogKey(created.api_key);
      setApiKeyCopied(false);
      setDeviceIdCopied(false);
      setApiKeyDialogOpen(true);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to create device");
    }
  };

  const handleUpdateDevice = async () => {
    if (!editingDevice) return;
    try {
      const updateData: UpdateSensorDeviceRequest = {
        location_id: deviceForm.location_id,
        who_deployed_it: deviceForm.who_deployed_it,
        serial_number: deviceForm.serial_number,
        status: deviceForm.status,
        metadata_json: deviceForm.metadata_json,
      };
      await updateSensorDevice(editingDevice.id, updateData);
      setDeviceDialogOpen(false);
      setEditingDevice(null);
      resetDeviceForm();
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to update device");
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to delete this device?")) return;
    try {
      await deleteSensorDevice(deviceId);
      fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to delete device");
    }
  };

  const openRegenerateConfirm = (device: SensorDevice) => {
    setRegenerateConfirmDevice(device);
    setRegenerateConfirmOpen(true);
  };

  const handleRegenerateApiKeyConfirm = async () => {
    const device = regenerateConfirmDevice;
    if (!device) return;
    setRegenerateConfirmOpen(false);
    setRegenerateConfirmDevice(null);
    setRegeneratingDeviceId(device.id);
    setError(null);
    try {
      const res = await regenerateDeviceApiKey(device.id);
      setApiKeyDialogDeviceName(device.serial_number);
      setApiKeyDialogDeviceId(res.device_id);
      setApiKeyDialogKey(res.api_key);
      setApiKeyCopied(false);
      setDeviceIdCopied(false);
      setApiKeyDialogOpen(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to regenerate API key");
    } finally {
      setRegeneratingDeviceId(null);
    }
  };

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard");
    }
  };

  const openDeviceDialog = (device?: SensorDevice) => {
    if (device) {
      setEditingDevice(device);
      setDeviceForm({
        location_id: device.location_id,
        who_deployed_it: device.who_deployed_it,
        serial_number: device.serial_number,
        status: device.status,
        metadata_json: device.metadata_json || {},
      });
    } else {
      setEditingDevice(null);
      resetDeviceForm();
    }
    setDeviceDialogOpen(true);
  };

  const resetDeviceForm = () => {
    setDeviceForm({
      location_id: "",
      who_deployed_it: "source",
      serial_number: "",
      status: "active",
      metadata_json: {},
    });
  };

  // Device approval and bulk action handlers
  const handleApproveDevice = async (deviceId: string) => {
    setError(null);
    try {
      await updateDeviceApproval(deviceId, "approved");
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to approve device");
    }
  };

  const handleRejectDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to reject this device?")) return;
    setError(null);
    try {
      await updateDeviceApproval(deviceId, "rejected");
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Failed to reject device");
    }
  };

  const handleBulkApprove = async () => {
    if (selectedDevices.size === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      const updates: BulkDeviceUpdateItem[] = Array.from(selectedDevices).map((id) => ({
        device_id: id,
        approval_status: "approved",
      }));
      await bulkUpdateSensorDevices(updates);
      setSelectedDevices(new Set());
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Bulk approval failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedDevices.size === 0) return;
    if (!confirm(`Are you sure you want to reject ${selectedDevices.size} device(s)?`)) return;
    setBulkLoading(true);
    setError(null);
    try {
      const updates: BulkDeviceUpdateItem[] = Array.from(selectedDevices).map((id) => ({
        device_id: id,
        approval_status: "rejected",
      }));
      await bulkUpdateSensorDevices(updates);
      setSelectedDevices(new Set());
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Bulk rejection failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedDevices.size === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      const updates: BulkDeviceUpdateItem[] = Array.from(selectedDevices).map((id) => ({
        device_id: id,
        status: bulkStatusValue,
      }));
      await bulkUpdateSensorDevices(updates);
      setSelectedDevices(new Set());
      setBulkStatusDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Bulk status update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkLocationUpdate = async () => {
    if (selectedDevices.size === 0 || !bulkLocationId) return;
    setBulkLoading(true);
    setError(null);
    try {
      const updates: BulkDeviceUpdateItem[] = Array.from(selectedDevices).map((id) => ({
        device_id: id,
        location_id: bulkLocationId,
      }));
      await bulkUpdateSensorDevices(updates);
      setSelectedDevices(new Set());
      setBulkLocationDialogOpen(false);
      await fetchData();
    } catch (err: any) {
      setError(err.message || "Bulk location update failed");
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <AdminRouteGuard>
      <AppShell
        sectionLabel="Administration"
        title="System control panel"
        subtitle="Users, locations, and sensor devices"
        icon={Shield}
        mainClassName="bg-transparent"
      >
        <div className="mx-auto max-w-7xl p-6 md:p-8">
              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                  <button
                    onClick={() => setError(null)}
                    className="ml-2 text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4 inline" />
                  </button>
                </div>
              )}

              {/* Tabs */}
              <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-border/60 bg-card/60 p-1.5 shadow-sm">
                {(
                  [
                    { id: "users" as TabType, label: "Users", icon: Users },
                    { id: "locations" as TabType, label: "Locations", icon: MapPin },
                    { id: "devices" as TabType, label: "Devices", icon: Database },
                  ] as const
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                      activeTab === id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Content */}
              {loading ? (
                <LoadingState
                  variant="inline"
                  message="Loading admin data"
                  hint="Fetching users, locations, and devices"
                  className="py-12"
                />
              ) : (
                <>
                  {/* Users Tab */}
                  {activeTab === "users" && (
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>
                              Manage system users and their roles
                            </CardDescription>
                          </div>
                          <Dialog
                            open={userDialogOpen}
                            onOpenChange={setUserDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button onClick={() => openUserDialog()}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add User
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {editingUser ? "Edit User" : "Create User"}
                                </DialogTitle>
                                <DialogDescription>
                                  {editingUser
                                    ? "Update user information"
                                    : "Add a new user to the system"}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label htmlFor="name">Name</Label>
                                  <Input
                                    id="name"
                                    value={userForm.name}
                                    onChange={(e) =>
                                      setUserForm({ ...userForm, name: e.target.value })
                                    }
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="email">Email</Label>
                                  <Input
                                    id="email"
                                    type="email"
                                    value={userForm.email}
                                    onChange={(e) =>
                                      setUserForm({ ...userForm, email: e.target.value })
                                    }
                                  />
                                </div>
                                {!editingUser && (
                                  <div>
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                      id="password"
                                      type="password"
                                      value={userForm.password}
                                      onChange={(e) =>
                                        setUserForm({
                                          ...userForm,
                                          password: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                )}
                                <div>
                                  <Label htmlFor="role">Role</Label>
                                  <select
                                    id="role"
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={userForm.role}
                                    onChange={(e) =>
                                      setUserForm({
                                        ...userForm,
                                        role: e.target.value as "admin" | "user",
                                      })
                                    }
                                  >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                  </select>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setUserDialogOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={
                                    editingUser ? handleUpdateUser : handleCreateUser
                                  }
                                >
                                  {editingUser ? "Update" : "Create"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                  No users found
                                </TableCell>
                              </TableRow>
                            ) : (
                              users.map((user) => (
                                <TableRow key={user.id}>
                                  <TableCell>{user.name}</TableCell>
                                  <TableCell>{user.email}</TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        user.role === "admin"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {user.role === "admin" ? (
                                        <Shield className="h-3 w-3 inline mr-1" />
                                      ) : null}
                                      {user.role}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {new Date(user.created_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openUserDialog(user)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setResetPasswordUserId(user.id);
                                          setResetPasswordDialogOpen(true);
                                        }}
                                      >
                                        Reset Password
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Locations Tab */}
                  {activeTab === "locations" && (
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle>Location Management</CardTitle>
                            <CardDescription>
                              Manage monitoring locations
                            </CardDescription>
                          </div>
                          <Dialog
                            open={locationDialogOpen}
                            onOpenChange={setLocationDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button onClick={() => openLocationDialog()}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Location
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  {editingLocation
                                    ? "Edit Location"
                                    : "Create Location"}
                                </DialogTitle>
                                <DialogDescription>
                                  {editingLocation
                                    ? "Update location information"
                                    : "Add a new monitoring location"}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label htmlFor="loc-name">Name</Label>
                                  <Input
                                    id="loc-name"
                                    value={locationForm.name}
                                    onChange={(e) =>
                                      setLocationForm({
                                        ...locationForm,
                                        name: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="latitude">Latitude</Label>
                                    <Input
                                      id="latitude"
                                      type="number"
                                      step="any"
                                      value={locationForm.latitude}
                                      onChange={(e) =>
                                        setLocationForm({
                                          ...locationForm,
                                          latitude: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="longitude">Longitude</Label>
                                    <Input
                                      id="longitude"
                                      type="number"
                                      step="any"
                                      value={locationForm.longitude}
                                      onChange={(e) =>
                                        setLocationForm({
                                          ...locationForm,
                                          longitude: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label htmlFor="description">Description</Label>
                                  <Input
                                    id="description"
                                    value={locationForm.description || ""}
                                    onChange={(e) =>
                                      setLocationForm({
                                        ...locationForm,
                                        description: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setLocationDialogOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={
                                    editingLocation
                                      ? handleUpdateLocation
                                      : handleCreateLocation
                                  }
                                >
                                  {editingLocation ? "Update" : "Create"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Coordinates</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Created</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {locations.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8">
                                  No locations found
                                </TableCell>
                              </TableRow>
                            ) : (
                              locations.map((location) => (
                                <TableRow key={location.id}>
                                  <TableCell className="font-medium">
                                    {location.name}
                                  </TableCell>
                                  <TableCell>
                                    {location.latitude.toFixed(4)},{" "}
                                    {location.longitude.toFixed(4)}
                                  </TableCell>
                                  <TableCell>
                                    {location.description || "-"}
                                  </TableCell>
                                  <TableCell>
                                    {new Date(location.created_at).toLocaleDateString()}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openLocationDialog(location)}
                                      >
                                        <Edit className="h-3 w-3" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteLocation(location)}
                                        disabled={locationDeleteLoading}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}

                  {/* Devices Tab */}
                  {activeTab === "devices" && (
                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-center">
                          <div>
                            <CardTitle>Device Management</CardTitle>
                            <CardDescription>
                              Manage sensor devices
                            </CardDescription>
                          </div>
                          <Dialog
                            open={deviceDialogOpen}
                            onOpenChange={setDeviceDialogOpen}
                          >
                            <DialogTrigger asChild>
                              <Button onClick={() => openDeviceDialog()}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Device
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>
                                  {editingDevice ? "Edit Device" : "Create Device"}
                                </DialogTitle>
                                <DialogDescription>
                                  {editingDevice
                                    ? "Update device information"
                                    : "Add a new sensor device"}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div>
                                  <Label htmlFor="device-location">Location</Label>
                                  <select
                                    id="device-location"
                                    className="w-full px-3 py-2 border rounded-md"
                                    value={deviceForm.location_id}
                                    onChange={(e) =>
                                      setDeviceForm({
                                        ...deviceForm,
                                        location_id: e.target.value,
                                      })
                                    }
                                  >
                                    <option value="">Select location</option>
                                    {locations.map((loc) => (
                                      <option key={loc.id} value={loc.id}>
                                        {loc.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <Label htmlFor="serial">Serial Number</Label>
                                  <Input
                                    id="serial"
                                    value={deviceForm.serial_number}
                                    onChange={(e) =>
                                      setDeviceForm({
                                        ...deviceForm,
                                        serial_number: e.target.value,
                                      })
                                    }
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label htmlFor="deployment">Deployment</Label>
                                    <select
                                      id="deployment"
                                      className="w-full px-3 py-2 border rounded-md"
                                      value={deviceForm.who_deployed_it}
                                      onChange={(e) =>
                                        setDeviceForm({
                                          ...deviceForm,
                                          who_deployed_it: e.target.value as
                                            | "source"
                                            | "custom",
                                        })
                                      }
                                    >
                                      <option value="source">Source</option>
                                      <option value="custom">Custom</option>
                                    </select>
                                  </div>
                                  <div>
                                    <Label htmlFor="status">Status</Label>
                                    <select
                                      id="status"
                                      className="w-full px-3 py-2 border rounded-md"
                                      value={deviceForm.status}
                                      onChange={(e) =>
                                        setDeviceForm({
                                          ...deviceForm,
                                          status: e.target.value as
                                            | "active"
                                            | "offline"
                                            | "maintenance",
                                        })
                                      }
                                    >
                                      <option value="active">Active</option>
                                      <option value="offline">Offline</option>
                                      <option value="maintenance">Maintenance</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setDeviceDialogOpen(false)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={
                                    editingDevice
                                      ? handleUpdateDevice
                                      : handleCreateDevice
                                  }
                                >
                                  {editingDevice ? "Update" : "Create"}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </CardHeader>
                      {selectedDevices.size > 0 && (
                        <div className="mx-6 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {selectedDevices.size}
                            </span>
                            <span className="text-sm font-medium text-foreground">
                              device{selectedDevices.size === 1 ? "" : "s"} selected
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDevices(new Set())}
                              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                              Clear selection
                            </Button>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleBulkApprove}
                              disabled={bulkLoading}
                              className="h-8 border-green-200 bg-green-50/50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                            >
                              <Check className="mr-1.5 h-3.5 w-3.5" />
                              Bulk Approve
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleBulkReject}
                              disabled={bulkLoading}
                              className="h-8 border-red-200 bg-red-50/50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
                            >
                              <X className="mr-1.5 h-3.5 w-3.5" />
                              Bulk Reject
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBulkStatusDialogOpen(true)}
                              disabled={bulkLoading}
                              className="h-8"
                            >
                              Update Status
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBulkLocationDialogOpen(true)}
                              disabled={bulkLoading}
                              className="h-8"
                            >
                              Update Location
                            </Button>
                          </div>
                        </div>
                      )}
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-gray-300"
                                  checked={devices.length > 0 && selectedDevices.size === devices.length}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedDevices(new Set(devices.map((d) => d.id)));
                                    } else {
                                      setSelectedDevices(new Set());
                                    }
                                  }}
                                />
                              </TableHead>
                              <TableHead>Serial Number</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Deployment</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Approval</TableHead>
                              <TableHead>Installed</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {devices.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={8} className="text-center py-8">
                                  No devices found
                                </TableCell>
                              </TableRow>
                            ) : (
                              devices.map((device) => {
                                const location = locations.find(
                                  (loc) => loc.id === device.location_id
                                );
                                return (
                                  <TableRow key={device.id} className={selectedDevices.has(device.id) ? "bg-muted/50" : ""}>
                                    <TableCell className="w-12">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300"
                                        checked={selectedDevices.has(device.id)}
                                        onChange={(e) => {
                                          const next = new Set(selectedDevices);
                                          if (e.target.checked) {
                                            next.add(device.id);
                                          } else {
                                            next.delete(device.id);
                                          }
                                          setSelectedDevices(next);
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="font-medium">
                                      {device.serial_number}
                                    </TableCell>
                                    <TableCell>
                                      {location?.name || "Unknown"}
                                    </TableCell>
                                    <TableCell>{device.who_deployed_it}</TableCell>
                                    <TableCell>
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          device.status === "active"
                                            ? "bg-green-100 text-green-800"
                                            : device.status === "offline"
                                            ? "bg-red-100 text-red-800"
                                            : "bg-yellow-100 text-yellow-800"
                                        }`}
                                      >
                                        {device.status}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={`px-2 py-1 rounded text-xs font-medium ${
                                          (device.approval_status || "approved") === "approved"
                                            ? "bg-green-100 text-green-800"
                                            : device.approval_status === "pending"
                                            ? "bg-yellow-100 text-yellow-800"
                                            : "bg-red-100 text-red-800"
                                        }`}
                                      >
                                        {device.approval_status || "approved"}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {device.installed_at
                                        ? new Date(device.installed_at).toLocaleDateString()
                                        : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1.5 flex-wrap items-center">
                                        {device.approval_status === "pending" ? (
                                          <>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleApproveDevice(device.id)}
                                              className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-950/50"
                                              title="Approve device"
                                            >
                                              <Check className="h-3 w-3 mr-1" />
                                              Approve
                                            </Button>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleRejectDevice(device.id)}
                                              className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/50"
                                              title="Reject device"
                                            >
                                              <X className="h-3 w-3 mr-1" />
                                              Reject
                                            </Button>
                                          </>
                                        ) : device.approval_status === "rejected" ? (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleApproveDevice(device.id)}
                                            className="h-7 px-2 text-xs text-green-700 border-green-200 hover:bg-green-50 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-950/50"
                                            title="Approve device"
                                          >
                                            <Check className="h-3 w-3 mr-1" />
                                            Approve
                                          </Button>
                                        ) : (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRejectDevice(device.id)}
                                            className="h-7 px-2 text-xs text-red-700 border-red-200 hover:bg-red-50 dark:text-red-300 dark:border-red-800 dark:hover:bg-red-950/50"
                                            title="Reject device"
                                          >
                                            <X className="h-3 w-3 mr-1" />
                                            Reject
                                          </Button>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openRegenerateConfirm(device)}
                                          disabled={regeneratingDeviceId === device.id}
                                          title="Regenerate API key (for device auth)"
                                          className="h-7 px-2"
                                        >
                                          {regeneratingDeviceId === device.id ? (
                                            <span className="animate-pulse">...</span>
                                          ) : (
                                            <Key className="h-3 w-3" />
                                          )}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openDeviceDialog(device)}
                                          className="h-7 px-2"
                                          title="Edit device"
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDeleteDevice(device.id)}
                                          className="h-7 px-2 text-red-600 hover:text-red-700"
                                          title="Delete device"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            )}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
        </AppShell>

        {/* Location cascade delete confirmation */}
        <Dialog
          open={locationDeleteConfirmOpen}
          onOpenChange={(open) => {
            if (!open) closeLocationDeleteConfirm();
            else setLocationDeleteConfirmOpen(true);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete location and all related data?</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    <strong>{locationDeleteTarget?.name}</strong> has{" "}
                    <strong>{locationDeleteConflict?.device_count ?? 0}</strong> sensor device
                    {(locationDeleteConflict?.device_count ?? 0) === 1 ? "" : "s"} and{" "}
                    <strong>
                      {(locationDeleteConflict?.reading_count ?? 0).toLocaleString()}
                    </strong>{" "}
                    reading
                    {(locationDeleteConflict?.reading_count ?? 0) === 1 ? "" : "s"}.
                  </p>
                  <p>
                    This will permanently delete all devices and readings
                    at this location. This cannot be undone.
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={closeLocationDeleteConfirm}
                disabled={locationDeleteLoading}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmCascadeDeleteLocation}
                disabled={locationDeleteLoading}
              >
                {locationDeleteLoading ? "Deleting…" : "Delete everything"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerate API Key – confirmation modal */}
        <Dialog open={regenerateConfirmOpen} onOpenChange={(open) => { setRegenerateConfirmOpen(open); if (!open) setRegenerateConfirmDevice(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Regenerate API key</DialogTitle>
              <DialogDescription>
                Regenerate the API key for device <strong>{regenerateConfirmDevice?.serial_number}</strong>? The current key will stop working immediately. You will need to update the device with the new key.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRegenerateConfirmOpen(false); setRegenerateConfirmDevice(null); }}>
                Cancel
              </Button>
              <Button onClick={handleRegenerateApiKeyConfirm}>
                Regenerate key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Regenerate API Key – show device ID and new key (copy and store securely) */}
        <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New API key generated</DialogTitle>
              <DialogDescription>
                Device: <strong>{apiKeyDialogDeviceName}</strong>. Copy both values now — the key won’t be shown again. The previous key is no longer valid.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Device ID</Label>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm break-all mt-1">
                  <span className="flex-1 select-all">{apiKeyDialogDeviceId}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(apiKeyDialogDeviceId, setDeviceIdCopied)}
                    className="shrink-0"
                  >
                    {deviceIdCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">API key</Label>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 font-mono text-sm break-all mt-1">
                  <span className="flex-1 select-all">{apiKeyDialogKey}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(apiKeyDialogKey, setApiKeyCopied)}
                    className="shrink-0"
                  >
                    {apiKeyCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">X-Device-ID</code> and <code className="bg-muted px-1 rounded">X-API-Key</code> headers when submitting readings from the device.
            </p>
            <DialogFooter>
              <Button onClick={() => setApiKeyDialogOpen(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
        <Dialog
          open={resetPasswordDialogOpen}
          onOpenChange={setResetPasswordDialogOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Enter a new password for this user
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setResetPasswordDialogOpen(false);
                  setNewPassword("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleResetPassword}>Reset Password</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Status Update Dialog */}
        <Dialog open={bulkStatusDialogOpen} onOpenChange={setBulkStatusDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk Update Device Status</DialogTitle>
              <DialogDescription>
                Set the status for {selectedDevices.size} selected device(s).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="bulk-status">New Status</Label>
                <select
                  id="bulk-status"
                  className="w-full px-3 py-2 border rounded-md mt-1"
                  value={bulkStatusValue}
                  onChange={(e) =>
                    setBulkStatusValue(
                      e.target.value as "active" | "offline" | "maintenance"
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="offline">Offline</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBulkStatusDialogOpen(false)}
                disabled={bulkLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleBulkStatusUpdate} disabled={bulkLoading}>
                {bulkLoading ? "Updating..." : "Update Status"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Location Update Dialog */}
        <Dialog open={bulkLocationDialogOpen} onOpenChange={setBulkLocationDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Bulk Update Device Location</DialogTitle>
              <DialogDescription>
                Assign {selectedDevices.size} selected device(s) to a new location.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="bulk-location">New Location</Label>
                <select
                  id="bulk-location"
                  className="w-full px-3 py-2 border rounded-md mt-1"
                  value={bulkLocationId}
                  onChange={(e) => setBulkLocationId(e.target.value)}
                >
                  <option value="">Select location</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBulkLocationDialogOpen(false)}
                disabled={bulkLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkLocationUpdate}
                disabled={bulkLoading || !bulkLocationId}
              >
                {bulkLoading ? "Updating..." : "Update Location"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </AdminRouteGuard>
  );
}

