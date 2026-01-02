"use client";
import React, { useEffect, useMemo, useState } from "react";
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
import { CheckCircle, Coins, Package, Receipt } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

import dayjs from "dayjs";
import "dayjs/locale/es";
import localizedFormat from "dayjs/plugin/localizedFormat";

import SelectM from "react-select";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatearMoneda } from "@/Crm/CrmServices/crm-service.types";
import CartCheckout from "./CartCheckout";
import DialogImages from "../DialogImages";
import { TipoComprobante } from "./interfaces";
import { formattMonedaGT } from "@/utils/formattMoneda";
import { ComprobanteSelector } from "./Components/ComprobanteSelector";
import { getApiErrorMessageAxios } from "../Utils/UtilsErrorApi";

import { useStore } from "@/components/Context/ContextSucursal";
import {
  useApiQuery,
  useApiMutation,
} from "@/hooks/genericoCall/genericoCallHook";

import type { NewQueryDTO } from "./interfaces/interfaces";
import {
  ProductoData,
  ProductosResponse,
} from "./interfaces/newProductsPOSResponse";
import TablePOS from "./table/header";
import { keepPreviousData } from "@tanstack/react-query";
import { MetodoPagoMainPOS } from "./interfaces/methodPayment";
import CreditoForm from "./credito-props-components/credito-form-component";
import { FormCreditoState } from "./credito-props-components/credito-venta.interfaces";
import { PaginatedResponse } from "../tipos-presentaciones/Interfaces/tiposPresentaciones.interfaces";
import { TipoPresentacion } from "../newCreateProduct/interfaces/DomainProdPressTypes";
import {
  CategoriaWithCount,
  CATS_LIST_QK,
} from "../Categorias/CategoriasMainPage";
// import { validateDpiNitEither } from "../Customers/helpers/regex.regex";

// =================== Dayjs ===================
dayjs.extend(localizedFormat);
dayjs.locale("es");
function formatearFechaUTC(fecha: string) {
  return dayjs(fecha).format("DD/MM/YYYY hh:mm A");
}

// =================== Tipos (compatibilidad con tus componentes actuales) ===================
enum RolPrecio {
  PUBLICO = "PUBLICO",
  MAYORISTA = "MAYORISTA",
  ESPECIAL = "ESPECIAL",
  DISTRIBUIDOR = "DISTRIBUIDOR",
  PROMOCION = "PROMOCION",
  CLIENTE_ESPECIAL = "CLIENTE_ESPECIAL",
}

type Stock = {
  id: number;
  cantidad: number;
  fechaIngreso: string; // ISO
  fechaVencimiento: string; // ISO
};

export type Precios = {
  id: number;
  precio: number; // <- importante: number (parse de string del backend)
  rol: RolPrecio;
};

export type imagenesProducto = {
  id: number;
  url: string;
};

type SourceType = "producto" | "presentacion";

type ProductoPOS = {
  id: number;
  source: SourceType; // 👈 NUEVO
  nombre: string;
  descripcion: string;
  precioVenta: number;
  codigoProducto: string;
  creadoEn: string;
  actualizadoEn: string;
  stock: Stock[];
  precios: Precios[];
  imagenesProducto: imagenesProducto[];
};

interface CartItem {
  uid: string; // 👈 clave única (source+id)
  id: number;
  source: SourceType; // 👈 NUEVO
  nombre: string;
  quantity: number;
  selectedPriceId: number;
  selectedPrice: number;
  selectedPriceRole: RolPrecio;
  precios: Precios[];
  stock: { cantidad: number }[];
}

type Client = {
  id: number;
  nombre: string;
  apellidos: string;
  telefono: string;
  dpi: string;
  nit: string;
  iPInternet: string;
  direccion: string;
  actualizadoEn: Date;
};

interface Venta {
  id: number;
  clienteId: number | null;
  fechaVenta: string;
  horaVenta: string;
  totalVenta: number;
  direccionClienteFinal: string | null;
  nombreClienteFinal: string | null;
  sucursalId: number;
  telefonoClienteFinal: string | null;
  imei: string;
}

interface Customer {
  id: number;
  nombre: string;
  telefono?: string;
  dpi?: string;
  nit?: string;
}

// =================== Mappers ===================

function useDebounce<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// =================== Componente ===================
export default function PuntoVenta() {
  const userId = useStore((state) => state.userId) ?? 0;
  const userRol = useStore((state) => state.userRol) ?? "";

  const sucursalId = useStore((state) => state.sucursalId) ?? 0;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<MetodoPagoMainPOS>(
    MetodoPagoMainPOS.EFECTIVO
  );
  const [tipoComprobante, setTipoComprobante] =
    useState<TipoComprobante | null>(TipoComprobante.RECIBO);
  const [referenciaPago, setReferenciaPago] = useState<string>("");

  const [openSection, setOpenSection] = useState(false);
  const [ventaResponse, setventaResponse] = useState<Venta | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );
  const [precioReques, setPrecioRequest] = useState<number | null>(null);
  const [openReques, setOpenRequest] = useState(false);
  const [openImage, setOpenImage] = useState(false);
  const [imagesProduct, setImagesProduct] = useState<string[]>([]);
  const [isDisableButton, setIsDisableButton] = useState(false);
  const [selectedCustomerID, setSelectedCustomerID] = useState<Customer | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("existing");
  // Datos del cliente ad-hoc (venta rápida)
  const [nombre, setNombre] = useState<string>("");
  const [apellidos, setApellidos] = useState<string>("");
  const [dpi, setDpi] = useState<string>("");
  const [nit, setNit] = useState<string>("");

  const [imei, setImei] = useState<string>("");
  const [telefono, setTelefono] = useState<string>("");
  const [direccion, setDireccion] = useState<string>("");
  const [observaciones, setObservaciones] = useState<string>("");
  // Estado controlado del formulario de crédito
  const [openCreateRequest, setOpenCreateRequest] = useState<boolean>(false);
  const totalCarrito = useMemo(
    () =>
      cart.reduce((acc, prod) => acc + prod.selectedPrice * prod.quantity, 0),
    [cart]
  );
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  const [creditoForm, setCreditoForm] = useState<FormCreditoState>(() => ({
    sucursalId,
    solicitadoPorId: userId,
    clienteId: selectedCustomerID?.id,
    nombreCliente: "",
    telefonoCliente: "",
    direccionCliente: "",
    totalPropuesto: r2(totalCarrito),
    cuotaInicialPropuesta: 0,
    cuotasTotalesPropuestas: 2,
    interesTipo: "NONE",
    interesPorcentaje: 0,
    planCuotaModo: "IGUALES",
    diasEntrePagos: 30,
    fechaPrimeraCuota: dayjs().add(30, "day").format("YYYY-MM-DD"),
    comentario: "",
    garantiaMeses: 0,
    testigos: undefined,
    cuotasPropuestas: [],
    lineas: [],
  }));
  type LineaForm = NonNullable<FormCreditoState["lineas"]>[number];

  // Mapea carrito -> líneas del crédito
  const mapCartToLineas = React.useCallback(
    (items: CartItem[]): NonNullable<FormCreditoState["lineas"]> =>
      items.map<LineaForm>((i) => ({
        productoId: i.source === "presentacion" ? undefined : i.id,
        presentacionId: i.source === "presentacion" ? i.id : undefined,
        cantidad: i.quantity,
        precioUnitario: i.selectedPrice,
        precioSeleccionadoId: i.selectedPriceId, //NUEVO
        subtotal:
          Math.round((i.quantity * i.selectedPrice + Number.EPSILON) * 100) /
          100,
        nombreProductoSnapshot: i.nombre,
        presentacionNombreSnapshot:
          i.source === "presentacion" ? i.nombre : undefined,
        codigoBarrasSnapshot: undefined,
      })),
    []
  );

  useEffect(() => {
    setCreditoForm((f) => ({
      ...f,
      sucursalId,
      clienteId: selectedCustomerID?.id,
      totalPropuesto: r2(totalCarrito),
    }));
  }, [sucursalId, selectedCustomerID?.id, totalCarrito]);

  useEffect(() => {
    setCreditoForm((f) => ({
      ...f,
      lineas: mapCartToLineas(cart),
    }));
  }, [cart, mapCartToLineas]);

  useEffect(() => {
    if (paymentMethod === MetodoPagoMainPOS.CREDITO) {
      setCreditoForm((f) => ({
        ...f,
        planCuotaModo: f.planCuotaModo ?? "IGUALES",
        interesTipo: f.interesTipo ?? "NONE",
        cuotasTotalesPropuestas: f.cuotasTotalesPropuestas || 6,
        diasEntrePagos: f.diasEntrePagos || 30,
        fechaPrimeraCuota:
          f.fechaPrimeraCuota || dayjs().add(30, "day").format("YYYY-MM-DD"),
      }));
    }
  }, [paymentMethod]);

  const [limit, setLimit] = useState<number>(5);
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const debouncedSearch = useDebounce(search, 400);

  const [queryOptions, setQueryOptions] = useState<NewQueryDTO>({
    cats: [],
    codigoItem: "",
    codigoProveedor: "",
    nombreItem: "",
    priceRange: "",
    tipoEmpaque: [],
    sucursalId,
    limit,
    page,
  });

  // Mantener query en sync con page/limit/sucursal
  useEffect(() => {
    setQueryOptions((prev) => ({
      ...prev,
      sucursalId,
      limit,
      page,
    }));
  }, [sucursalId, limit, page]);

  // =================== Queries via wrapper ===================
  type NewQueryPOS = NewQueryDTO & { q?: string };

  // 3) Memo de los filtros que viajan a la API (NO mutar aquí)
  const apiParams = React.useMemo<NewQueryPOS>(() => {
    const p: Partial<NewQueryPOS> = {
      sucursalId,
      limit,
      page,
      q: debouncedSearch || undefined, // 👈 CANÓNICO
    };

    // Solo añade filtros ortogonales si existen
    if (queryOptions.cats?.length) p.cats = queryOptions.cats;
    if (queryOptions.codigoProveedor)
      p.codigoProveedor = queryOptions.codigoProveedor;
    if (queryOptions.tipoEmpaque) p.tipoEmpaque = queryOptions.tipoEmpaque;
    if (queryOptions.priceRange) p.priceRange = queryOptions.priceRange;

    return p as NewQueryPOS;
  }, [
    debouncedSearch,
    sucursalId,
    limit,
    page,
    queryOptions.cats,
    queryOptions.codigoProveedor,
    queryOptions.tipoEmpaque,
    queryOptions.priceRange,
  ]);

  // Productos para POS (nuevo contrato del servidor)
  // 4) Usa SIEMPRE el memo en key y params
  const {
    data: productsResponse = {
      data: [],
      meta: {
        limit: 10,
        page: 1,
        totalCount: 0,
        totalPages: 1,
        totals: { presentaciones: 0, productos: 0 },
      },
    },
    refetch: refetchProducts,
    isFetching: isLoadingProducts,
    isError: isErrorProducts,
    error: errorProducts,
  } = useApiQuery<ProductosResponse>(
    ["products-pos-response", apiParams],
    "products/get-products-presentations-for-pos",
    { params: apiParams },
    {
      refetchOnWindowFocus: true,
      placeholderData: keepPreviousData,
      staleTime: 0,
    }
  );

  // Clientes
  const {
    data: customersResponse,
    isError: isErrorCustomers,
    error: errorCustomers,
  } = useApiQuery<Client[]>(
    ["clients-all"],
    "client/get-all-customers"
    // { enabled: true }
  );

  const { mutateAsync: createSale, isPending: isCreatingSale } = useApiMutation<
    any,
    any
  >("post", "venta");

  const { mutateAsync: createPriceRequest, isPending: isCreatingPriceRequest } =
    useApiMutation<any, any>("post", "price-request");

  //esperar respuesta del admin? como?
  const {
    mutateAsync: createCreditRequest,
    isPending: isPendingCreditRequest,
  } = useApiMutation<any, any>(
    "post",
    "credito-authorization/create-authorization"
  );

  const { data: tiposPresentacionesResponse } = useApiQuery<
    PaginatedResponse<TipoPresentacion>
  >(["empaques"], "tipo-presentacion");

  const { data: cats } = useApiQuery<CategoriaWithCount[]>(
    CATS_LIST_QK,
    "/categoria/all-cats-with-counts",
    undefined,
    {
      staleTime: 0,
      refetchOnMount: "always",
    }
  );
  const categorias = Array.isArray(cats) ? cats : [];
  const tiposPresentacion = tiposPresentacionesResponse?.data ?? [];

  // =================== Efectos de datos ===================
  // PRODUCTOS SEGUROS
  const productos = Array.isArray(productsResponse.data)
    ? productsResponse.data
    : [];

  const meta = productsResponse.meta ?? {
    page: 1,
    limit: 10,
    totalPages: 1,
    totalCount: 0,
  };

  // Handlers para la paginación (server-side)
  const handlePageChange = (nextPage: number) => {
    setPage(Math.max(1, Math.min(nextPage, meta.totalPages || 1)));
  };

  const handleLimitChange = (nextLimit: number) => {
    setLimit(nextLimit);
    setPage(1); // reset page cuando cambia pageSize
  };

  // Errores
  useEffect(() => {
    if (isErrorProducts && errorProducts) {
      toast.error(getApiErrorMessageAxios(errorProducts));
    }
    if (isErrorCustomers && errorCustomers) {
      toast.error(getApiErrorMessageAxios(errorCustomers));
    }
  }, [isErrorProducts, errorProducts, isErrorCustomers, errorCustomers]);

  // =================== Lógica de Carrito ===================
  const handleSearchItemsInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    setPage(1);
  };

  const makeUid = (s: SourceType, id: number) => `${s}-${id}`;

  const addToCart = (product: ProductoPOS) => {
    const uid = makeUid(product.source, product.id);

    const existingItem = cart.find((item) => item.uid === uid); // 👈 ahora por uid
    if (existingItem) {
      setCart((prev) =>
        prev.map((item) =>
          item.uid === uid ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
      return;
    }

    const initial = product.precios?.[0];
    const initialPriceId = initial?.id ?? 0;
    const initialPrice = initial?.precio ?? 0;

    const newCartItem: CartItem = {
      uid,
      id: product.id,
      source: product.source, // 👈 conserva el origen
      nombre: product.nombre,
      precios: product.precios,
      stock: product.stock,
      quantity: 1,
      selectedPriceId: initialPriceId,
      selectedPrice: initialPrice,
      selectedPriceRole: (initial?.rol as RolPrecio) ?? RolPrecio.PUBLICO,
    };

    setCart((prev) => [...prev, newCartItem]);
  };

  /** Mapper por defecto (por si no envías uno desde el padre) */
  function defaultMapToCartProduct(p: ProductoData): ProductoPOS {
    return {
      id: p.id,
      source: (p.__source as SourceType) ?? "producto", // 👈 importante
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      precioVenta: 0,
      codigoProducto: p.codigoProducto,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
      stock: (p.stocks ?? []).map((s) => ({
        id: s.id,
        cantidad: s.cantidad,
        fechaIngreso: s.fechaIngreso || "",
        fechaVencimiento: s.fechaVencimiento || "",
      })),
      precios: (p.precios ?? []).map((pr) => ({
        id: pr.id,
        precio: Number(pr.precio) || 0,
        rol: (pr.rol as RolPrecio) ?? RolPrecio.PUBLICO,
      })),
      imagenesProducto: (p.images ?? [])
        .filter((im) => !!im?.url)
        .map((im) => ({ id: im.id ?? 0, url: im.url ?? "" })),
    };
  }

  const handleImageClick = (images: string[]) => {
    setOpenImage(true);
    setImagesProduct(images);
  };

  const handleClose = () => setOpenSection(false);

  // =================== Select clientes ===================
  const customerOptions = useMemo(
    () =>
      (customersResponse ?? []).map((c) => ({
        value: c.id,
        label: `${c.nombre} ${c?.apellidos ?? ""} ${
          c.telefono ? `(${c.telefono})` : ""
        } ${c.dpi ? `DPI: ${c.dpi}` : "DPI: N/A"} ${
          c.nit ? `NIT: ${c.nit}` : "NIT: N/A"
        } ${c.iPInternet ? `IP: ${c.iPInternet}` : ""}`,
      })),
    [customersResponse]
  );

  // =================== Validaciones & helpers ===================

  const isReferenceInvalid =
    paymentMethod === "TRANSFERENCIA" && !referenciaPago;
  const isButtonDisabled =
    isDisableButton || isReferenceInvalid || isCreatingSale;

  // =================== Actions ===================
  async function handleMakeRequest() {
    if (precioReques && precioReques <= 0) {
      toast.info("La cantidad a solicitar no debe ser negativa");
      return;
    }
    if (!selectedProductId) {
      toast.info("Debe seleccionar un producto primero");
      return;
    }

    try {
      await createPriceRequest({
        productoId: Number(selectedProductId),
        precioSolicitado: precioReques,
        solicitadoPorId: userId,
      });
      toast.success(
        "Solicitud enviada, esperando respuesta del administrador..."
      );
      setPrecioRequest(null);
      setSelectedProductId("");
      setOpenRequest(false);
    } catch (error) {
      toast.error(getApiErrorMessageAxios(error));
    }
  }

  const handleCreateCreditRequest = async (payload: any) => {
    try {
      //validar cliente, metodo de pago, monto, etc.

      toast.promise(createCreditRequest(payload), {
        success: "Crédito enviado para autorización, esperando respuesta...",
        loading: "Enviando solicitud de aprovación de crédito",
        error: (error) => getApiErrorMessageAxios(error),
      });

      console.log("PAYLOAD GENERADO POR CREDITO REQ: ", payload);
    } catch (error) {
      toast.error(getApiErrorMessageAxios(error));
    } finally {
      //limpiar campos, limpiar cart, cliente, etc... Y fetchear datos de nuevo, refresh
    }
  };

  const handleCompleteSale = async () => {
    setIsDisableButton(true);

    if (!selectedCustomerID?.id) {
      // const cliente = {
      //   nombre: nombre?.trim(),
      //   apellidos: apellidos?.trim(),
      //   direccion: direccion?.trim(),
      //   dpi: dpi?.trim(),
      //   nit: nit?.trim(),
      // };
      // if (cliente.nombre) {
      //   const res = validateDpiNitEither(cliente.dpi, cliente.nit);
      //   if (!res.ok) {
      //     toast.warning(res.msg || "DPI o NIT no válidos");
      //     setIsDisableButton(false);
      //     return;
      //   }
      // }
    }

    const saleData = {
      actorRol: userRol,
      usuarioId: userId,
      sucursalId,
      clienteId: selectedCustomerID?.id ?? null,
      productos: cart.map((item) => ({
        cantidad: item.quantity,
        selectedPriceId: item.selectedPriceId,
        ...(item.source === "presentacion"
          ? { presentacionId: item.id }
          : { productoId: item.id }),
      })),
      metodoPago: paymentMethod || "CONTADO",
      tipoComprobante: tipoComprobante,
      referenciaPago: referenciaPago,
      monto: totalCarrito,
      // cliente “rápido”
      nombre: nombre.trim(),
      apellidos: apellidos.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      dpi: dpi.trim(),
      nit: nit.trim(),
      observaciones: observaciones.trim(),
      imei: imei.trim(),
    };

    console.log("EL payload es: ", saleData);

    const isCustomerInfoProvided = !!saleData.nombre && !!saleData.telefono;

    if (
      saleData.monto > 1000 &&
      !saleData.clienteId &&
      !isCustomerInfoProvided
    ) {
      toast.warning(
        "Para ventas mayores a 1000 es necesario ingresar o seleccionar un cliente"
      );
      setIsDisableButton(false);
      return;
    }

    if (!tipoComprobante) {
      toast.info("Seleccione Recibo o Factura");
      setIsDisableButton(false);
      return;
    }

    try {
      const resp = await createSale(saleData);
      toast.success("Venta completada con éxito");
      setReferenciaPago("");
      setPaymentMethod(MetodoPagoMainPOS.CONTADO);
      setTipoComprobante(TipoComprobante.RECIBO);
      setIsDialogOpen(false);
      setCart([]);
      setImei("");
      setventaResponse(resp);
      setSelectedCustomerID(null);
      setNombre("");
      setApellidos("");
      setTelefono("");
      setDireccion("");
      setDpi("");
      setObservaciones("");
      setNit("");
      // Refrescar productos
      refetchProducts();

      setTimeout(() => setOpenSection(true), 200);
    } catch (error) {
      toast.error(getApiErrorMessageAxios(error));
    } finally {
      setTimeout(() => setIsDisableButton(false), 300);
    }
  };

  const updateQuantityByUid = (uid: string, qty: number) => {
    setCart((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, quantity: qty } : i))
    );
  };

  const updatePriceByUid = (
    uid: string,
    newPrice: number,
    newRole: RolPrecio
  ) => {
    setCart((prev) =>
      prev.map((i) =>
        i.uid === uid
          ? {
              ...i,
              selectedPrice: newPrice,
              selectedPriceRole: newRole,
              selectedPriceId:
                i.precios.find(
                  (p) => p.precio === newPrice && p.rol === newRole
                )?.id ?? i.selectedPriceId,
            }
          : i
      )
    );
  };

  const removeFromCartByUid = (uid: string) => {
    setCart((prev) => prev.filter((i) => i.uid !== uid));
  };

  const isCreditoVenta = paymentMethod === MetodoPagoMainPOS.CREDITO;

  // helper: uid consistente con la tabla

  const getRemainingForRow = React.useCallback(
    (p: ProductoData) => {
      const source = (p.__source as SourceType) ?? "producto";
      const uid = makeUid(source, p.id);
      const totalStock = (p.stocks ?? []).reduce((a, s) => a + s.cantidad, 0);
      const reserved = cart.find((i) => i.uid === uid)?.quantity ?? 0;
      // futuro: si tienes stock en tiempo real por WS, úsalo aquí:
      // const live = liveStockByUid[uid] ?? totalStock;
      return Math.max(0, totalStock - reserved);
    },
    [cart]
  );

  console.log("Los registro de productos son: ", productos);
  console.log("El carrito es: ", cart);
  console.log("el resultado del server es: ", productsResponse);
  console.log("el cliente seleccionado es: ", selectedCustomerID);
  console.log("el creditoForm es: ", creditoForm);
  console.log("El query es: ", queryOptions);
  console.log("los tipos de presentacion son: ", tiposPresentacion);

  return (
    <div className="container">
      <div
        className="
  grid grid-cols-1 gap-4 items-start
  md:[grid-template-columns:minmax(0,1fr)_clamp(360px,40vw,420px)]
  xl:[grid-template-columns:minmax(0,1fr)_clamp(380px,32vw,440px)] 
"
      >
        {/* Lista de Productos (se  mantiene) */}
        <div className="min-w-0">
          <TablePOS
            categorias={categorias}
            tiposPresentacion={tiposPresentacion}
            searchValue={search}
            defaultMapToCartProduct={defaultMapToCartProduct}
            addToCart={addToCart}
            handleImageClick={handleImageClick}
            isLoadingProducts={isLoadingProducts}
            handleSearchItemsInput={handleSearchItemsInput}
            queryOptions={queryOptions}
            setQueryOptions={setQueryOptions}
            data={productos}
            //NUEVO
            page={meta.page}
            limit={meta.limit}
            totalPages={meta.totalPages}
            totalCount={meta.totalCount}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            //
            getRemainingFor={getRemainingForRow}
          />
        </div>

        <div className="min-w-0">
          {/* Carrito & Checkout (se mantiene) */}
          <CartCheckout
            nit={nit}
            setNit={setNit}
            //
            userRol={userRol}
            isCreditoVenta={isCreditoVenta}
            apellidos={apellidos}
            setApellidos={setApellidos}
            cart={cart}
            setReferenciaPago={setReferenciaPago}
            referenciaPago={referenciaPago}
            tipoComprobante={tipoComprobante}
            setTipoComprobante={setTipoComprobante}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            imei={imei}
            setImei={setImei}
            selectedCustomerID={selectedCustomerID}
            setSelectedCustomerID={setSelectedCustomerID}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            nombre={nombre}
            setNombre={setNombre}
            telefono={telefono}
            setTelefono={setTelefono}
            dpi={dpi}
            setDpi={setDpi}
            direccion={direccion}
            setDireccion={setDireccion}
            observaciones={observaciones}
            setObservaciones={setObservaciones}
            customerOptions={customerOptions}
            onUpdateQuantity={updateQuantityByUid}
            onUpdatePrice={updatePriceByUid}
            onRemoveFromCart={removeFromCartByUid}
            onCompleteSale={() => setIsDialogOpen(true)}
            formatCurrency={(n) =>
              new Intl.NumberFormat("es-GT", {
                style: "currency",
                currency: "GTQ",
              })
                .format(n)
                .replace("GTQ", "Q")
            }
          />
        </div>
      </div>

      {isCreditoVenta ? (
        <CreditoForm
          userRol={userRol}
          openCreateRequest={openCreateRequest}
          setOpenCreateRequest={setOpenCreateRequest}
          value={creditoForm}
          onChange={setCreditoForm}
          handleCreateCreditRequest={handleCreateCreditRequest} //reemplazo temporal
          isPendingCreditRequest={isPendingCreditRequest}
          // opcional: onSubmit={(payload) => createCreditRequest(payload)}
        />
      ) : null}

      {/* PETICIÓN DE PRECIO ESPECIAL */}
      <div className="mt-10">
        <Card className="shadow-md rounded-lg border overflow-hidden">
          <CardHeader className=" p-6">
            <CardTitle className="text-xl font-semibold">
              Petición de precio especial
            </CardTitle>
            <CardDescription className="text-sm text-gray-600  dark:text-white">
              Al solicitar un precio especial, esa instancia sólo se podrá usar
              en una venta.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Producto */}
              <div className="flex flex-col">
                <Label className="text-sm font-medium mb-1">Producto</Label>
                <SelectM
                  placeholder="Seleccionar producto"
                  options={productos.map((p) => ({
                    value: String(p.id),
                    label: `${p.nombre} (${p.codigoProducto})`,
                  }))}
                  className="basic-select text-sm h-10 text-black"
                  classNamePrefix="select"
                  onChange={(opt) => setSelectedProductId(opt?.value ?? "")}
                  value={
                    selectedProductId
                      ? {
                          value: selectedProductId,
                          label: `${
                            productos.find(
                              (p) => String(p.id) === selectedProductId
                            )?.nombre
                          } (${
                            productos.find(
                              (p) => String(p.id) === selectedProductId
                            )?.codigoProducto
                          })`,
                        }
                      : null
                  }
                />
              </div>

              {/* Precio Requerido */}
              <div className="flex flex-col">
                <Label className="text-sm font-medium mb-1">
                  Precio Requerido
                </Label>
                <Input
                  type="number"
                  className="h-10 text-sm"
                  placeholder="100.00"
                  value={precioReques ?? ""}
                  onChange={(e) =>
                    setPrecioRequest(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>
            </div>

            <Button
              onClick={() => setOpenRequest(true)}
              variant="default"
              className="w-full py-2 text-sm"
              disabled={isCreatingPriceRequest}
            >
              Solicitar precio especial
            </Button>

            <Dialog open={openReques} onOpenChange={setOpenRequest}>
              <DialogContent className="w-full max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg font-semibold text-center">
                    Solicitar precio especial
                  </DialogTitle>
                  <DialogDescription className="text-sm text-center text-gray-600">
                    Esta instancia sólo se podrá aplicar a una venta.
                    ¿Continuar?
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={handleMakeRequest}
                    disabled={
                      !precioReques ||
                      !selectedProductId ||
                      isCreatingPriceRequest
                    }
                    className="px-4 py-2 text-sm"
                  >
                    Confirmar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>

      {/* DIALOG DE IMÁGENES */}
      <DialogImages
        images={imagesProduct}
        openImage={openImage}
        setOpenImage={setOpenImage}
      />

      {/* DIALOG DE VENTA EXITOSA */}
      <Dialog open={openSection} onOpenChange={setOpenSection}>
        <DialogContent className="max-w-md mx-auto p-0 overflow-hidden">
          <div className="relative p-6 pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-center text-gray-900 mb-2 dark:text-white">
              Venta Registrada
            </h2>
            <p className="dark:text-white text-center text-gray-600 text-sm">
              La venta se ha procesado exitosamente
            </p>
          </div>

          {ventaResponse && (
            <div className="dark:bg-zinc-950 px-6 py-4 bg-gray-50 border-y">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600  dark:text-white ">
                    Número de Venta:
                  </span>
                  <span className="font-semibold text-gray-900  dark:text-white ">
                    #{ventaResponse.id}
                  </span>
                </div>
                <div className="flex justify-between items-center ">
                  <span className="text-sm text-gray-600  dark:text-white ">
                    Fecha y Hora:
                  </span>
                  <span className="font-semibold text-gray-900 text-sm  dark:text-white ">
                    {formatearFechaUTC(ventaResponse.fechaVenta)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-base font-medium text-gray-900 dark:text-white ">
                    Total:
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    {formattMonedaGT(ventaResponse.totalVenta)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 pt-4">
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-11 border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent dark:text-white dark:hover:bg-transparent "
                onClick={handleClose}
              >
                Mantenerse
              </Button>

              <Link
                to={`/venta/generar-factura/${ventaResponse?.id}`}
                className="flex-1"
              >
                <Button
                  className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-medium"
                  onClick={handleClose}
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Imprimir Comprobante
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* DIALOG CONFIRMAR VENTA */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="bg-purple-50 dark:bg-zinc-900 p-4">
            <DialogHeader className="text-center space-y-2">
              <div className="flex justify-center">
                <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-2 rounded-full animate-pulse">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
              </div>
              <DialogTitle className="text-base font-bold text-gray-800 dark:text-gray-100 text-center">
                Confirmar Venta
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="p-4 space-y-4 bg-purple-50 dark:bg-zinc-900">
            <div className="bg-purple-50 dark:bg-zinc-950 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                <Package className="h-3 w-3" />
                Resumen de productos
              </div>

              <div className="space-y-1 max-h-20 overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.uid}
                    className="flex justify-between items-center text-xs"
                  >
                    <span className="text-gray-600 dark:text-gray-400 truncate">
                      {item.nombre} × {item.quantity}
                    </span>
                    <span className="font-medium text-gray-600 dark:text-gray-400">
                      {formatearMoneda(item.selectedPrice * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <Separator className="dark:bg-gray-700" />

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1">
                  <Coins className="h-3 w-3 text-green-600 dark:text-green-400" />
                  <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                    Total
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatearMoneda(totalCarrito)}
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs bg-gray-200 dark:bg-gray-700"
                  >
                    {cart.length} {cart.length === 1 ? "artículo" : "artículos"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className=" justify-center items-center flex">
              <ComprobanteSelector
                tipo={tipoComprobante}
                setTipo={setTipoComprobante}
              />
            </div>

            {referenciaPago && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Referencia de Pago
                </div>
                <div className="text-sm font-mono text-blue-800 dark:text-blue-200">
                  {referenciaPago}
                </div>
              </div>
            )}

            {isReferenceInvalid && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2 border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-medium text-blue-700 dark:text-blue-300">
                  El número de boleta no puede estar vacío
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => setIsDialogOpen(false)}
                variant="destructive"
                size="sm"
                className="flex-1 h-8 text-sm"
                disabled={isDisableButton}
              >
                Cancelar
              </Button>
              <Button
                disabled={isButtonDisabled}
                size="sm"
                onClick={handleCompleteSale}
                className="flex-1 h-8 text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold"
              >
                {isDisableButton || isCreatingSale ? (
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">Procesando...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Confirmar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
