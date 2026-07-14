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

  const refreshUser = useAuthStore((state) => state.refreshUser);
  const router = useRouter();

  useEffect(() => {
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
                      <CardContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Serial Number</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Deployment</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Installed</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {devices.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                  No devices found
                                </TableCell>
                              </TableRow>
                            ) : (
                              devices.map((device) => {
                                const location = locations.find(
                                  (loc) => loc.id === device.location_id
                                );
                                return (
                                  <TableRow key={device.id}>
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
                                      {device.installed_at
                                        ? new Date(device.installed_at).toLocaleDateString()
                                        : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openRegenerateConfirm(device)}
                                          disabled={regeneratingDeviceId === device.id}
                                          title="Regenerate API key (for device auth)"
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
                                        >
                                          <Edit className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => handleDeleteDevice(device.id)}
                                          className="text-red-600 hover:text-red-700"
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
    </AdminRouteGuard>
  );
}

