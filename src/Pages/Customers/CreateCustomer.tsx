import { useMemo, useState, ChangeEvent, FormEvent, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";

// shadcn/ui
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// icons
import {
  UserPlus,
  Search,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  Save,
  X,
  BadgeHelp,
} from "lucide-react";

// helpers / hooks
import { PageHeader } from "@/utils/components/PageHeaderPos";
import { AdvancedDialog } from "@/utils/components/AdvancedDialog";
import { getApiErrorMessageAxios } from "@/Pages/Utils/UtilsErrorApi";
import {
  useApiMutation,
  useApiQuery,
} from "@/hooks/genericoCall/genericoCallHook";

// ================= Types =================
interface ClienteResponse {
  id: number;
  nombre: string;
  apellidos: string;
  telefono: string;
  dpi: string | null;
  nit: string | null;
  direccion: string;
  observaciones?: string | null;
  actualizadoEn: string;
  _count: { compras: number };
}

interface FormData {
  nombre: string;
  apellidos?: string;
  telefono?: string;
  direccion?: string;
  dpi?: string;
  nit?: string;
  observaciones?: string;
}

interface FormDataEdit
  extends Required<Pick<ClienteResponse, "id" | "nombre">> {
  apellidos?: string;
  telefono?: string;
  direccion?: string;
  dpi?: string;
  nit?: string;
  observaciones?: string;
}

// ================= Utils =================

// ================ Edit Dialog ================
function EditCustomerDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onSaveClick,
  onAskDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: FormDataEdit;
  onChange: (patch: Partial<FormDataEdit>) => void;
  onSaveClick: () => void; // abre el AdvancedDialog de confirmación
  onAskDelete: () => void; // abre el AdvancedDialog de confirmación
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-center">
            Editar cliente
          </DialogTitle>
          <DialogDescription className="text-center">
            Actualiza sólo los campos necesarios.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="edit-nombre">Nombre</Label>
            <Input
              id="edit-nombre"
              value={value.nombre}
              onChange={(e) => onChange({ nombre: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-apellidos">Apellidos</Label>
            <Input
              id="edit-apellidos"
              value={value.apellidos ?? ""}
              onChange={(e) => onChange({ apellidos: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-telefono">Teléfono</Label>
            <Input
              id="edit-telefono"
              value={value.telefono ?? ""}
              onChange={(e) => onChange({ telefono: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-dpi">DPI</Label>
            <Input
              id="edit-dpi"
              value={value.dpi ?? ""}
              onChange={(e) => onChange({ dpi: e.target.value })}
              placeholder="13 dígitos"
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="edit-nit">NIT</Label>
            <Input
              id="edit-nit"
              value={value.nit ?? ""}
              onChange={(e) => onChange({ nit: e.target.value })}
              placeholder="7–11 dígitos (+K opcional)"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="edit-direccion">Dirección</Label>
            <Input
              id="edit-direccion"
              value={value.direccion ?? ""}
              onChange={(e) => onChange({ direccion: e.target.value })}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="edit-observaciones">Observaciones</Label>
            <Textarea
              id="edit-observaciones"
              value={value.observaciones ?? ""}
              onChange={(e) => onChange({ observaciones: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-2 mt-4">
          <Button variant="destructive" onClick={onAskDelete} className="gap-2">
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="gap-2"
          >
            <X className="h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={onSaveClick} className="gap-2">
            <Save className="h-4 w-4" /> Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ================ Page ================
export default function ClientesPageRefactor() {
  // ---------- state ----------
  const [formData, setFormData] = useState<FormData>({
    nombre: "",
    apellidos: "",
    telefono: "",
    direccion: "",
    dpi: "",
    nit: "",
    observaciones: "",
  });

  const [search, setSearch] = useState("");
  const [orderBy, setOrderBy] = useState<"more" | "less">("more");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<FormDataEdit>({ id: 0, nombre: "" });

  // advanced dialogs
  const [openConfirmCreate, setOpenConfirmCreate] = useState(false);
  const [openConfirmSave, setOpenConfirmSave] = useState(false);
  const [openConfirmDelete, setOpenConfirmDelete] = useState(false);

  const queryClient = useQueryClient();

  // ---------- data (React Query) ----------
  const clientesQuery = useApiQuery<ClienteResponse[]>(
    ["clientes"],
    "/client/get-all-customers",
    undefined,
    { staleTime: 60_000 }
  );

  const crearCliente = useApiMutation<unknown, FormData, any>(
    "post",
    "/client",
    undefined,
    {
      onSuccess: () => {
        toast.success("Cliente creado");
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        setFormData({
          nombre: "",
          apellidos: "",
          telefono: "",
          direccion: "",
          dpi: "",
          nit: "",
          observaciones: "",
        });
      },
      onError: (err: any) => toast.error(getApiErrorMessageAxios(err)),
    }
  );

  const actualizarCliente = useApiMutation<unknown, FormDataEdit, any>(
    "patch",
    `/client/${editData.id || 0}`,
    undefined,
    {
      onSuccess: () => {
        toast.success("Cliente actualizado");
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        setEditOpen(false);
      },
      onError: (err: any) => toast.error(getApiErrorMessageAxios(err)),
    }
  );

  const eliminarCliente = useApiMutation<unknown, void, any>(
    "delete",
    `/client/${editData.id || 0}`,
    undefined,
    {
      onSuccess: () => {
        toast.success("Cliente eliminado");
        queryClient.invalidateQueries({ queryKey: ["clientes"] });
        setEditOpen(false);
      },
      onError: (err: any) => toast.error(getApiErrorMessageAxios(err)),
    }
  );

  // ---------- derived data ----------
  const clientes = clientesQuery.data ?? [];
  const loading = clientesQuery.isPending;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = clientes.filter((c) =>
      [
        c.nombre,
        c.apellidos ?? "",
        c.direccion ?? "",
        c.telefono ?? "",
        c.dpi ?? "",
        c.nit ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );

    list.sort((a, b) =>
      orderBy === "more"
        ? b._count.compras - a._count.compras
        : a._count.compras - b._count.compras
    );

    return list;
  }, [clientes, search, orderBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentItems = filtered.slice((page - 1) * perPage, page * perPage);

  useEffect(() => {
    // si cambias el término de búsqueda, vuelve a la página 1
    setPage(1);
  }, [search]);

  // ---------- handlers ----------
  const onCreateChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const onCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // const { ok, msg } = validateDpiNitEither(formData.dpi, formData.nit);
    // if (!ok) {
    //   toast.warning(msg);
    //   return;
    // }
    setOpenConfirmCreate(true);
  };

  const handleConfirmCreate = async () => {
    await crearCliente.mutateAsync(formData);
    setOpenConfirmCreate(false);
  };

  const handleEditClick = (c: ClienteResponse) => {
    setEditData({
      id: c.id,
      nombre: c.nombre ?? "",
      apellidos: c.apellidos ?? "",
      telefono: c.telefono ?? "",
      direccion: c.direccion ?? "",
      dpi: c.dpi ?? "",
      nit: c.nit ?? "",
      observaciones: c.observaciones ?? "",
    });
    setEditOpen(true);
  };

  const handleConfirmSave = async () => {
    // validaciones mínimas
    if (!editData.nombre?.trim()) {
      toast.warning("El nombre es requerido");
      return;
    }
    // const { ok, msg } = validateDpiNitEither(editData.dpi, editData.nit);
    // if (!ok) {
    //   toast.warning(msg);
    //   return;
    // }
    await actualizarCliente.mutateAsync(editData);
    setOpenConfirmSave(false);
  };

  const handleConfirmDelete = async () => {
    await eliminarCliente.mutateAsync();
    setOpenConfirmDelete(false);
  };

  // ---------- UI ----------
  return (
    <div className="container mx-auto px-3 sm:px-6">
      <PageHeader
        title="Clientes"
        fallbackBackTo="/"
        sticky={false}
        subtitle="Crea y administra tus clientes"
      />

      <Tabs defaultValue="crear" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="crear" className="gap-2">
            <UserPlus className="h-4 w-4" /> Crear
          </TabsTrigger>
          <TabsTrigger value="lista">Clientes</TabsTrigger>
        </TabsList>

        {/* Crear */}
        <TabsContent value="crear">
          <Card className="shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-center">
                Crear cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={onCreateSubmit}
                className="grid gap-4 max-w-2xl mx-auto"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={onCreateChange}
                      placeholder="Nombres del cliente"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="apellidos">Apellidos</Label>
                    <Input
                      id="apellidos"
                      name="apellidos"
                      value={formData.apellidos ?? ""}
                      onChange={onCreateChange}
                      placeholder="Apellidos del cliente"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="dpi">DPI</Label>
                    <Input
                      id="dpi"
                      name="dpi"
                      value={formData.dpi ?? ""}
                      onChange={onCreateChange}
                      placeholder="13 dígitos"
                      inputMode="numeric"
                    />
                    {/* CAMBIAR ESTE TEXTO */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <BadgeHelp className="h-3 w-3" /> Opcional (o ingrese NIT)
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="nit">NIT</Label>
                    <Input
                      id="nit"
                      name="nit"
                      value={formData.nit ?? ""}
                      onChange={onCreateChange}
                      placeholder="7–11 dígitos (+K opcional)"
                    />

                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <BadgeHelp className="h-3 w-3" /> Opcional
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      value={formData.telefono ?? ""}
                      onChange={onCreateChange}
                      placeholder="No. telefónico"
                      inputMode="tel"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="direccion">Dirección</Label>
                    <Input
                      id="direccion"
                      name="direccion"
                      value={formData.direccion ?? ""}
                      onChange={onCreateChange}
                      placeholder="Dirección del cliente"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="observaciones">Observaciones</Label>
                  <Textarea
                    id="observaciones"
                    name="observaciones"
                    value={formData.observaciones ?? ""}
                    onChange={onCreateChange}
                    placeholder="Alguna observación o dato sobre el cliente"
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="min-w-40"
                    disabled={crearCliente.isPending}
                  >
                    {crearCliente.isPending ? "Guardando…" : "Guardar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lista */}
        <TabsContent value="lista">
          <Card className="shadow-md">
            <CardHeader className="pb-2">
              <CardTitle>Clientes</CardTitle>
              <CardDescription>Busca, ordena y edita.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre, apellidos, DPI, NIT, teléfono o dirección"
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Select
                  value={orderBy}
                  onValueChange={(v) => setOrderBy(v as "more" | "less")}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Orden" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="more">Más compras primero</SelectItem>
                    <SelectItem value="less">Menos compras primero</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Mobile list (cards) */}
              <div className="md:hidden grid grid-cols-1 gap-3">
                {loading && (
                  <p className="text-center py-6 text-muted-foreground">
                    Cargando…
                  </p>
                )}
                {!loading && currentItems.length === 0 && (
                  <p className="text-center py-6 text-muted-foreground">
                    Sin resultados
                  </p>
                )}
                {currentItems.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="rounded-2xl">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base font-semibold">
                            {c.nombre} {c.apellidos ? ` ${c.apellidos}` : ""}
                          </CardTitle>
                          <Badge variant="secondary">#{c.id}</Badge>
                        </div>
                        <CardDescription>
                          {c.telefono ? `📞 ${c.telefono}` : "Sin teléfono"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p>
                          <strong>DPI:</strong> {c.dpi || "—"}
                        </p>
                        <p>
                          <strong>NIT:</strong> {c.nit || "—"}
                        </p>
                        <p className="truncate">
                          <strong>Dirección:</strong> {c.direccion || "—"}
                        </p>
                        <div className="flex items-center justify-between pt-2">
                          <Link to={`/cliente-historial-compras/${c.id}`}>
                            <Button variant="outline" size="sm">
                              Compras: {c._count?.compras ?? 0}
                            </Button>
                          </Link>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEditClick(c)}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="rounded-xl border overflow-hidden hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">No.</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Apellidos</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>DPI</TableHead>
                      <TableHead>NIT</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Cargando…
                        </TableCell>
                      </TableRow>
                    )}
                    {!loading && currentItems.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="text-center py-8 text-muted-foreground"
                        >
                          Sin resultados
                        </TableCell>
                      </TableRow>
                    )}
                    {currentItems.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.id}</TableCell>
                        <TableCell>{c.nombre || "—"}</TableCell>
                        <TableCell>{c.apellidos || "N/A"}</TableCell>
                        <TableCell>{c.telefono || "N/A"}</TableCell>
                        <TableCell>{c.dpi || "N/A"}</TableCell>
                        <TableCell>{c.nit || "N/A"}</TableCell>
                        <TableCell className="max-w-[280px] truncate">
                          {c.direccion || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link to={`/cliente-historial-compras/${c.id}`}>
                            <Button variant="outline">
                              {c._count?.compras ?? 0}
                            </Button>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleEditClick(c)}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableCaption>Clientes disponibles</TableCaption>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center py-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </PaginationPrevious>
                    </PaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 || p === totalPages || Math.abs(p - page) <= 1
                      )
                      .map((p, idx, arr) => (
                        <PaginationItem key={p}>
                          {idx > 0 && p - (arr[idx - 1] as number) > 1 ? (
                            <span className="px-2">…</span>
                          ) : null}
                          <PaginationLink
                            isActive={p === page}
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      ))}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </PaginationNext>
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </CardContent>
            <CardFooter />
          </Card>
        </TabsContent>
      </Tabs>

      {/* AdvancedDialog: confirmar CREAR */}
      <AdvancedDialog
        title="Confirmación de creación"
        description={
          "Se creará el cliente con los datos ingresados. Esta acción no se puede deshacer."
        }
        open={openConfirmCreate}
        onOpenChange={setOpenConfirmCreate}
        confirmButton={{
          label: crearCliente.isPending ? "Guardando…" : "Sí, crear",
          onClick: handleConfirmCreate,
          variant: "default",
          loading: crearCliente.isPending,
          loadingText: "Guardando…",
        }}
        cancelButton={{
          label: "Cancelar",
          disabled: crearCliente.isPending,
          onClick: () => setOpenConfirmCreate(false),
        }}
      />

      {/* Edit dialog */}
      <EditCustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        value={editData}
        onChange={(patch) => setEditData((prev) => ({ ...prev, ...patch }))}
        onSaveClick={() => setOpenConfirmSave(true)}
        onAskDelete={() => setOpenConfirmDelete(true)}
      />

      {/* AdvancedDialog: confirmar GUARDAR EDICIÓN */}
      <AdvancedDialog
        title="Confirmar actualización"
        description={"Se actualizará el cliente con la información editada."}
        open={openConfirmSave}
        onOpenChange={setOpenConfirmSave}
        confirmButton={{
          label: actualizarCliente.isPending ? "Actualizando…" : "Sí, guardar",
          onClick: handleConfirmSave,
          variant: "default",
          loading: actualizarCliente.isPending,
          loadingText: "Actualizando…",
        }}
        cancelButton={{
          label: "Cancelar",
          disabled: actualizarCliente.isPending,
          onClick: () => setOpenConfirmSave(false),
        }}
      />

      {/* AdvancedDialog: confirmar ELIMINAR */}
      <AdvancedDialog
        title="¿Eliminar cliente?"
        description={
          "Esta acción es permanente. Se eliminará el cliente y sus registros asociados."
        }
        open={openConfirmDelete}
        onOpenChange={setOpenConfirmDelete}
        confirmButton={{
          label: eliminarCliente.isPending ? "Eliminando…" : "Sí, eliminar",
          onClick: handleConfirmDelete,
          variant: "destructive",
          loading: eliminarCliente.isPending,
          loadingText: "Eliminando…",
        }}
        cancelButton={{
          label: "Cancelar",
          disabled: eliminarCliente.isPending,
          onClick: () => setOpenConfirmDelete(false),
        }}
      />
    </div>
  );
}
