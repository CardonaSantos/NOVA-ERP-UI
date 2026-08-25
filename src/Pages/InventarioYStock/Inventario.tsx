import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QueryTable } from "./interfaces/querytable";
import TableInventario from "./table/table";
import { PaginatedInventarioResponse } from "./interfaces/InventaryInterfaces";
import { Package2, RotateCcw, Tag, X } from "lucide-react";
import { Link } from "react-router-dom";
import FiltersSection from "./filters/filters-sections";
import { CategoriaWithCount } from "../Categorias/CategoriasMainPage";
import { TipoPresentacion } from "../newCreateProduct/interfaces/DomainProdPressTypes";
import {
  PayloadDeleteProduct,
  useDeleteProduct,
} from "@/hooks/use-products/use-products";
import { toast } from "sonner";
import { getApiErrorMessageAxios } from "../Utils/UtilsErrorApi";
import { AdvancedDialogERP } from "@/utils/components/dialog/advanced-dialog";
import { useStore } from "@/components/Context/ContextSucursal";

type PaginationState = {
  pageIndex: number;
  pageSize: number;
};

interface InventarioProps {
  categorias: CategoriaWithCount[];
  loadInventoryData: () => Promise<void>;
  setSearchQuery: React.Dispatch<React.SetStateAction<QueryTable>>;
  searchQuery: QueryTable;
  productsInventario: PaginatedInventarioResponse;
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>;
  pagination: PaginationState;
  isloadingInventario: boolean;
  handleSelectCat: (ids: number[]) => void;
  handleSelecTiposEmpaque: (ids: number[]) => void;
  tiposPresentacion: TipoPresentacion[];
  rolUser: string;
}

export default function Inventario({
  categorias,
  loadInventoryData,
  setSearchQuery,
  searchQuery,
  productsInventario,
  setPagination,
  pagination,
  isloadingInventario,
  tiposPresentacion,
  handleSelectCat,
  handleSelecTiposEmpaque,
  rolUser,
}: InventarioProps) {
  const userId = useStore((state) => state.userId) ?? 0;

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [productoIdToDelete, setProductoIdToDelete] = React.useState<number>(0);
  const [pass, setPass] = useState<string>("");

  const eliminarProductoMutation = useDeleteProduct(productoIdToDelete);

  const resetDeleteState = React.useCallback(() => {
    setProductoIdToDelete(0);
    setDeleteDialogOpen(false);
    setPass("");
  }, []);

  const handlePickDelete = React.useCallback((id: number) => {
    setProductoIdToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteProducto = React.useCallback(() => {
    if (!productoIdToDelete) {
      toast.warning("Seleccione un producto válido");
      return;
    }

    const payload: PayloadDeleteProduct = {
      password: pass.trim(),
      userId,
    };

    if (!payload.password.length) {
      toast.warning("Ingrese su contraseña");
      return;
    }

    toast.promise(eliminarProductoMutation.mutateAsync(payload), {
      success: () => {
        resetDeleteState();
        void loadInventoryData();
        return "Producto eliminado de inventario";
      },
      loading: "Eliminando registro...",
      error: (error) => getApiErrorMessageAxios(error),
    });
  }, [
    productoIdToDelete,
    pass,
    userId,
    eliminarProductoMutation,
    resetDeleteState,
    loadInventoryData,
  ]);

  const handleOpenDeleteDialogChange = React.useCallback(
    (open: boolean) => {
      setDeleteDialogOpen(open);

      if (!open) {
        resetDeleteState();
      }
    },
    [resetDeleteState],
  );
  // COMENTARIO PARA COMITEAR
  return (
    <>
      <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_auto] items-start">
        {/* Controles (input + selects) */}
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))] items-end">
          {/* Buscar */}
          <div className="min-w-0 grid gap-1">
            <label className="text-xs">Buscar</label>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setSearchQuery((prev) => ({
                    ...prev,
                    codigoProducto: "",
                    productoNombre: "",
                  }))
                }
                className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-red-600"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>

              <Input
                type="search"
                placeholder="Buscar por nombre o código de producto"
                className="pl-8 h-9 text-sm"
                value={searchQuery.productoNombre ?? ""}
                onChange={(e) =>
                  setSearchQuery((prev) => ({
                    ...prev,
                    productoNombre: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <FiltersSection
            handleSelecTiposEmpaque={handleSelecTiposEmpaque}
            tiposPresentacion={tiposPresentacion}
            searchQuery={searchQuery}
            cats={categorias}
            handleSelectCat={handleSelectCat}
          />
        </div>

        {/* Acciones (derecha en desktop, abajo en mobile) */}
        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
          <Button
            onClick={loadInventoryData}
            disabled={isloadingInventario}
            aria-busy={isloadingInventario}
            className="inline-flex items-center gap-2 h-9 px-3"
            variant="secondary"
          >
            <RotateCcw
              className={`h-4 w-4 ${isloadingInventario ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Refrescar</span>
          </Button>

          <Link to={"/categorias"}>
            <Button
              variant="outline"
              className="inline-flex items-center justify-center h-9 w-9 p-0"
              title="Etiquetas o filtros"
            >
              <Tag className="h-4 w-4" />
            </Button>
          </Link>

          <Link to={"/tipos-presentaciones"}>
            <Button
              variant="outline"
              className="inline-flex items-center justify-center h-9 w-9 p-0"
              title="Tipos de presentaciones"
            >
              <Package2 className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <TableInventario
        rolUser={rolUser}
        pagination={pagination}
        setPagination={setPagination}
        data={productsInventario.data}
        meta={productsInventario.meta}
        onRequestDeleteProduct={handlePickDelete}
      />

      <AdvancedDialogERP
        type="destructive"
        title="Eliminar producto"
        description="
             ¿Seguro que deseas eliminar el producto?
              Esta acción no se puede deshacer."
        open={deleteDialogOpen}
        onOpenChange={handleOpenDeleteDialogChange}
        cancelButton={{
          label: "Cancelar",
          disabled: eliminarProductoMutation.isPending,
          onClick: resetDeleteState,
        }}
        confirmButton={{
          label: "Eliminar",
          loading: eliminarProductoMutation.isPending,
          loadingText: "Eliminando...",
          onClick: handleDeleteProducto,
        }}
        children={
          <div className="">
            <Input
              type="password"
              placeholder="Ingrese su contraseña"
              value={pass}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPass(e.target.value)
              }
            />
          </div>
        }
      />
    </>
  );
}
