import React from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "@/components/Context/ContextSucursal";
import { QueryTable } from "./interfaces/querytable";
import { PaginatedInventarioResponse } from "./interfaces/InventaryInterfaces";
import { PageTransition } from "@/components/Transition/layout-transition";
import { useGetCategorias } from "@/hooks/use-categorias/use-categorias";
import { useTiposPresentaciones } from "@/hooks/use-tipos-presentaciones/use-tipos-presentaciones";
import { useGetInventary } from "@/hooks/use-products/use-products";
import Inventario from "./Inventario";

type PaginationState = {
  pageIndex: number;
  pageSize: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const EMPTY_INVENTORY_RESPONSE: PaginatedInventarioResponse = {
  data: [],
  meta: {
    limit: DEFAULT_LIMIT,
    page: DEFAULT_PAGE,
    totalCount: 0,
    totalPages: 0,
  },
};

function clampLimit(value: unknown) {
  const limit = Number(value) || DEFAULT_LIMIT;
  return Math.min(Math.max(1, limit), 100);
}

function parsePage(value: unknown) {
  return Math.max(1, Number(value) || DEFAULT_PAGE);
}

function parseNumberArray(value: string | null): number[] {
  if (!value) return [];

  return value
    .split(",")
    .map((x) => Number(x))
    .filter(Number.isFinite);
}

function setOrDeleteParam(
  params: URLSearchParams,
  key: string,
  value: string | number | null | undefined,
) {
  const rawValue = String(value ?? "");

  // Elimina el parámetro si está vacío o contiene solamente espacios.
  if (!rawValue.trim()) {
    params.delete(key);
    return;
  }

  // Conserva el valor original mientras el usuario escribe.
  params.set(key, rawValue);
}

function setArrayParam(
  params: URLSearchParams,
  key: string,
  values: number[] | undefined,
) {
  const safeValues = Array.isArray(values)
    ? values.map(Number).filter(Number.isFinite)
    : [];

  if (!safeValues.length) {
    params.delete(key);
    return;
  }

  params.set(key, safeValues.join(","));
}

function getPaginationFromParams(params: URLSearchParams): PaginationState {
  const page = parsePage(params.get("page"));
  const limit = clampLimit(params.get("limit"));

  return {
    pageIndex: page - 1,
    pageSize: limit,
  };
}

function getQueryFromParams(
  params: URLSearchParams,
  sucursalId: number,
): QueryTable {
  const pagination = getPaginationFromParams(params);

  return {
    sucursalId,
    categorias: parseNumberArray(params.get("categorias")),
    tiposPresentacion: parseNumberArray(params.get("tiposPresentacion")),
    codigoProducto: params.get("codigoProducto") ?? "",
    productoNombre: params.get("productoNombre") ?? "",
    fechaVencimiento: params.get("fechaVencimiento") ?? "",
    precio: params.get("precio") ?? "",
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  };
}

function writeQueryToParams(
  currentParams: URLSearchParams,
  query: QueryTable,
  options?: {
    resetPage?: boolean;
  },
) {
  const nextParams = new URLSearchParams(currentParams);

  setOrDeleteParam(nextParams, "productoNombre", query.productoNombre);
  setOrDeleteParam(nextParams, "codigoProducto", query.codigoProducto);
  setOrDeleteParam(nextParams, "fechaVencimiento", query.fechaVencimiento);
  setOrDeleteParam(nextParams, "precio", query.precio);

  setArrayParam(nextParams, "categorias", query.categorias);
  setArrayParam(nextParams, "tiposPresentacion", query.tiposPresentacion);

  if (options?.resetPage ?? true) {
    nextParams.set("page", String(DEFAULT_PAGE));
  } else {
    nextParams.set("page", String(parsePage(query.page)));
  }

  const limit = clampLimit(query.limit);
  if (limit === DEFAULT_LIMIT) {
    nextParams.delete("limit");
  } else {
    nextParams.set("limit", String(limit));
  }

  return nextParams;
}

function InventarioStockPage() {
  const rolUser = useStore((s) => s.userRol) ?? "";
  const sucursalId = useStore((s) => s.sucursalId) ?? 0;

  const [searchParams, setSearchParams] = useSearchParams();

  const pagination = React.useMemo(
    () => getPaginationFromParams(searchParams),
    [searchParams],
  );

  const searchQuery = React.useMemo(
    () => getQueryFromParams(searchParams, sucursalId),
    [searchParams, sucursalId],
  );

  const setInventoryQuery = React.useCallback<
    React.Dispatch<React.SetStateAction<QueryTable>>
  >(
    (updater) => {
      setSearchParams(
        (prevParams) => {
          const currentQuery = getQueryFromParams(prevParams, sucursalId);

          const nextQuery =
            typeof updater === "function" ? updater(currentQuery) : updater;

          return writeQueryToParams(prevParams, nextQuery, {
            resetPage: true,
          });
        },
        { replace: true },
      );
    },
    [setSearchParams, sucursalId],
  );

  const setPagination = React.useCallback<
    React.Dispatch<React.SetStateAction<PaginationState>>
  >(
    (updater) => {
      setSearchParams(
        (prevParams) => {
          const currentPagination = getPaginationFromParams(prevParams);

          const nextPagination =
            typeof updater === "function"
              ? updater(currentPagination)
              : updater;

          const nextParams = new URLSearchParams(prevParams);

          const nextPage = Math.max(1, nextPagination.pageIndex + 1);
          const nextLimit = clampLimit(nextPagination.pageSize);

          if (nextPage === DEFAULT_PAGE) {
            nextParams.delete("page");
          } else {
            nextParams.set("page", String(nextPage));
          }

          if (nextLimit === DEFAULT_LIMIT) {
            nextParams.delete("limit");
          } else {
            nextParams.set("limit", String(nextLimit));
          }

          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleSelectCat = React.useCallback(
    (ids: number[]) => {
      setInventoryQuery((prev) => ({
        ...prev,
        categorias: ids,
      }));
    },
    [setInventoryQuery],
  );

  const handleSelecTiposEmpaque = React.useCallback(
    (ids: number[]) => {
      setInventoryQuery((prev) => ({
        ...prev,
        tiposPresentacion: ids,
      }));
    },
    [setInventoryQuery],
  );

  const {
    data: productsInventario = EMPTY_INVENTORY_RESPONSE,
    refetch: reFetchInventario,
    isFetching: isloadingInventario,
  } = useGetInventary(searchQuery);

  const { data: categorias } = useGetCategorias();
  const { data: presentations } = useTiposPresentaciones();

  const categoriasSecure = Array.isArray(categorias) ? categorias : [];
  const tiposPresentacion = Array.isArray(presentations?.data)
    ? presentations.data
    : [];

  const reloadInventaryData = React.useCallback(async () => {
    await reFetchInventario();
  }, [reFetchInventario]);

  return (
    <PageTransition fallbackBackTo="/" titleHeader="Inventario General">
      <Inventario
        rolUser={rolUser}
        handleSelecTiposEmpaque={handleSelecTiposEmpaque}
        tiposPresentacion={tiposPresentacion}
        handleSelectCat={handleSelectCat}
        setSearchQuery={setInventoryQuery}
        categorias={categoriasSecure}
        loadInventoryData={reloadInventaryData}
        searchQuery={searchQuery}
        productsInventario={productsInventario}
        setPagination={setPagination}
        pagination={pagination}
        isloadingInventario={isloadingInventario}
      />
    </PageTransition>
  );
}

export default InventarioStockPage;
