// pages/ventas/Invoice.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import dayjs from "dayjs";
import "dayjs/locale/es";
import localizedFormat from "dayjs/plugin/localizedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { User } from "lucide-react";

import logo from "@/assets/NOVAPOSPNG.png";
import type { VentaHistorialPDF } from "@/Types/PDF/VentaHistorialPDF";
import { formatearMoneda } from "@/Pages/Requisicion/PDF/Pdf";
import { useApiQuery } from "@/hooks/genericoCall/genericoCallHook";
import { PageHeader } from "@/utils/components/PageHeaderPos";

dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.locale("es");

const formatDate = (fecha: string) =>
  dayjs(fecha).format("DD MMMM YYYY, hh:mm:ss A");

export default function Invoice() {
  const { id } = useParams();
  const facturaRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const {
    data: venta,
    isLoading,
    isError,
  } = useApiQuery<VentaHistorialPDF>(
    ["venta-pdf", id],
    `/venta/get-sale/${id}`,
    undefined,
    {
      enabled: Boolean(id),
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!venta || !facturaRef.current) return;
    let revoked = false;

    const generarPDF = async () => {
      try {
        await new Promise((r) => requestAnimationFrame(() => r(null)));

        const canvas = await html2canvas(facturaRef.current as HTMLDivElement, {
          scale: 1.5, // calidad decente sin disparar el peso
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({ unit: "mm", format: "a4" });
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
        const blob = pdf.output("blob");

        if (!revoked) setPdfUrl(URL.createObjectURL(blob));
      } catch (error) {
        console.error("Error al generar PDF:", error);
      }
    };

    generarPDF();
    return () => {
      revoked = true;
    };
  }, [venta]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-500 mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-slate-700">
            Cargando comprobante...
          </p>
        </div>
      </div>
    );
  }

  if (isError || !venta) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-600">
          Error: No se pudo cargar la información de la venta
        </p>
      </div>
    );
  }

  const total =
    venta.productos?.reduce(
      (acc, item) => acc + item.precioVenta * item.cantidad,
      0
    ) ?? 0;

  const nombreCliente =
    [venta.cliente?.nombre, venta.cliente?.apellidos]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" ") ||
    venta.nombreClienteFinal ||
    "CF";

  return (
    <div className="p-4 bg-slate-50 min-h-screen">
      <PageHeader
        title="Comprobante de venta"
        fallbackBackTo="/"
        sticky={false}
      />
      {/* Botón flotante fijo */}
      {pdfUrl && (
        <a
          href={pdfUrl}
          download={`Comprobante_${venta.id}.pdf`}
          className="
      fixed bottom-4 right-4
      z-50
      bg-amber-500 hover:bg-amber-600
      text-white font-semibold
      px-4 py-2 rounded-full
      shadow-lg shadow-amber-300/50
      transition-all duration-200
      flex items-center gap-2
      active:scale-95
    "
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M7.5 10.5L12 15m0 0l4.5-4.5M12 15V3"
            />
          </svg>
          Descargar
        </a>
      )}

      {/* Área que se rasteriza al PDF */}
      <div
        ref={facturaRef}
        className={`shadow-sm rounded-md ${pdfUrl ? "hidden" : "block"}`}
        style={{
          width: "210mm",
          minHeight: "297mm",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          color: "#0f172a", // slate-900
          padding: "24mm 18mm 18mm",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          // Números tabulares para alinear precios/cantidades:
          fontFeatureSettings: "'tnum' 1, 'lnum' 1",
        }}
      >
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <img
                src={logo}
                className="w-[6rem] h-[6rem]"
                alt="Logo"
                crossOrigin="anonymous"
              />
              <div>
                <h1 className="text-base font-semibold leading-tight text-slate-800">
                  {venta.sucursal.nombre}
                </h1>
                <p className="text-[11px] text-slate-600">
                  {/* Herramientas y Materiales de Construcción */}
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[11px] text-slate-500">Comprobante</p>
              <p className="text-sm font-medium tracking-wide text-slate-800">
                #{venta.id}
              </p>
            </div>
          </div>

          {/* línea divisoria sutil */}
          <div className="mt-4 h-px w-full bg-slate-200" />
        </header>

        {/* Info de empresa / venta */}
        <section className="mb-5">
          <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-700">
            <div className="rounded-md border border-slate-200 p-3">
              <h3 className="text-[11px] font-medium text-slate-800 mb-2 tracking-wide">
                Sucursal
              </h3>
              <div className="space-y-1">
                <p>
                  <span className="text-slate-500">Dirección:&nbsp;</span>
                  {venta.sucursal?.direccion || "No disponible"}
                </p>
                <p>
                  <span className="text-slate-500">Teléfono:&nbsp;</span>
                  {venta.sucursal?.telefono || "No disponible"}
                </p>
              </div>
            </div>

            <div className="rounded-md border border-slate-200 p-3">
              <h3 className="text-[11px] font-medium text-slate-800 mb-2 tracking-wide">
                Detalles
              </h3>
              <div className="space-y-1">
                <p>
                  <span className="text-slate-500">Fecha:&nbsp;</span>
                  {formatDate(venta.fechaVenta)}
                </p>
                <p>
                  <span className="text-slate-500">Método de pago:&nbsp;</span>
                  {venta.metodoPago?.metodoPago || "No especificado"}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Cliente */}
        <section className="mb-6">
          <div className="rounded-md border border-slate-200 p-3">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-slate-500" />
              <h3 className="text-[11px] font-medium text-slate-800 tracking-wide">
                Cliente
              </h3>
            </div>

            {venta.cliente ? (
              <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-700">
                <div className="space-y-1">
                  <p>
                    <span className="text-slate-500">Nombre:&nbsp;</span>
                    {nombreCliente}
                  </p>
                  <p>
                    <span className="text-slate-500">Teléfono:&nbsp;</span>
                    {venta.cliente?.telefono ||
                      venta.telefonoClienteFinal ||
                      "No proporcionado"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p>
                    <span className="text-slate-500">Dirección:&nbsp;</span>
                    {venta.cliente?.direccion ||
                      venta.direccionClienteFinal ||
                      "No proporcionada"}
                  </p>
                  {venta.cliente?.dpi && (
                    <p>
                      <span className="text-slate-500">DPI:&nbsp;</span>
                      {venta.cliente.dpi}
                    </p>
                  )}
                  {venta.imei && (
                    <p>
                      <span className="text-slate-500">IMEI:&nbsp;</span>
                      {venta.imei}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-700">
                Detalles del cliente:&nbsp;
                <span className="text-slate-800 font-medium">
                  Cliente Final
                </span>
              </p>
            )}
          </div>
        </section>

        {/* Productos */}
        <section className="mb-6">
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table
              className="w-full"
              style={{ fontSize: "11px", borderCollapse: "collapse" }}
            >
              <thead>
                <tr className="bg-slate-50 text-slate-700">
                  <th className="py-2.5 px-3 text-left font-medium border-b border-slate-200">
                    Producto
                  </th>
                  <th className="py-2.5 px-3 text-center font-medium border-b border-slate-200">
                    Cant.
                  </th>
                  <th className="py-2.5 px-3 text-right font-medium border-b border-slate-200">
                    Precio unit.
                  </th>
                  <th className="py-2.5 px-3 text-right font-medium border-b border-slate-200">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {venta.productos?.map((item, index) => (
                  <tr
                    key={item.id ?? index}
                    className={index % 2 === 0 ? "bg-white" : "bg-slate-50/70"}
                    style={{ borderBottom: "1px solid #e2e8f0" }} // slate-200
                  >
                    <td className="py-2 px-3 align-top">
                      <div>
                        <p className="font-normal text-slate-800 leading-snug">
                          {item.producto?.nombre || "Producto no disponible"}
                        </p>
                        {item.producto?.descripcion && (
                          <p className="text-[10px] text-slate-500 mt-1 leading-snug">
                            {item.producto.descripcion}
                          </p>
                        )}
                      </div>
                    </td>
                    <td
                      className="py-2 px-3 text-center font-normal text-slate-800"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {item.cantidad}
                    </td>
                    <td
                      className="py-2 px-3 text-right font-normal text-slate-800"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatearMoneda(item.precioVenta)}
                    </td>
                    <td
                      className="py-2 px-3 text-right font-normal text-slate-800"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatearMoneda(item.precioVenta * item.cantidad)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Totales */}
        <section className="mb-6">
          <div className="flex justify-end">
            <div className="rounded-md border border-amber-100 bg-amber-50/40 px-4 py-2">
              <p
                className="text-sm font-semibold text-slate-800"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                TOTAL: {formatearMoneda(total)}
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="pt-3">
          <div className="h-px w-full bg-slate-200 mb-2" />
          <div className="text-[10px] text-slate-600 text-center leading-relaxed">
            <p className="text-slate-700">¡Gracias por su compra!</p>
            <p>{venta.sucursal.nombre}</p>
          </div>
        </footer>
      </div>

      {/* Visor PDF */}
      {pdfUrl && (
        <div className="mt-6">
          <div className="bg-white rounded-md shadow-sm p-4 border border-slate-200">
            <iframe
              src={pdfUrl}
              className="w-full h-[80vh] border border-slate-200 rounded"
              title="Vista previa del comprobante"
            />
          </div>
        </div>
      )}
    </div>
  );
}
