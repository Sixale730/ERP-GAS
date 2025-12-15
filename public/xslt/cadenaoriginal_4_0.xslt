<?xml version="1.0" encoding="UTF-8"?>
<!--
  XSLT para Cadena Original CFDI 4.0
  Basado en la especificacion del SAT Anexo 20

  NOTA: Este XSLT espera XML SIN prefijos de namespace (sin cfdi:)
  El codigo TypeScript elimina los namespaces antes de procesar
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform">

  <xsl:output method="text" encoding="UTF-8"/>

  <!-- Template principal -->
  <xsl:template match="/">
    <xsl:text>||</xsl:text>
    <xsl:apply-templates select="Comprobante"/>
    <xsl:text>|</xsl:text>
  </xsl:template>

  <!-- Comprobante -->
  <xsl:template match="Comprobante">
    <!-- Version (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Version"/>
    </xsl:call-template>
    <!-- Serie (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Serie"/>
    </xsl:call-template>
    <!-- Folio (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Folio"/>
    </xsl:call-template>
    <!-- Fecha (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Fecha"/>
    </xsl:call-template>
    <!-- FormaPago (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@FormaPago"/>
    </xsl:call-template>
    <!-- NoCertificado (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@NoCertificado"/>
    </xsl:call-template>
    <!-- CondicionesDePago (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@CondicionesDePago"/>
    </xsl:call-template>
    <!-- SubTotal (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@SubTotal"/>
    </xsl:call-template>
    <!-- Descuento (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Descuento"/>
    </xsl:call-template>
    <!-- Moneda (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Moneda"/>
    </xsl:call-template>
    <!-- TipoCambio (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@TipoCambio"/>
    </xsl:call-template>
    <!-- Total (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Total"/>
    </xsl:call-template>
    <!-- TipoDeComprobante (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@TipoDeComprobante"/>
    </xsl:call-template>
    <!-- Exportacion (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Exportacion"/>
    </xsl:call-template>
    <!-- MetodoPago (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@MetodoPago"/>
    </xsl:call-template>
    <!-- LugarExpedicion (requerido) -->
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@LugarExpedicion"/>
    </xsl:call-template>
    <!-- Confirmacion (opcional) -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Confirmacion"/>
    </xsl:call-template>

    <!-- Procesar nodos hijos en orden SAT -->
    <xsl:apply-templates select="InformacionGlobal"/>
    <xsl:apply-templates select="CfdiRelacionados"/>
    <xsl:apply-templates select="Emisor"/>
    <xsl:apply-templates select="Receptor"/>
    <xsl:apply-templates select="Conceptos"/>
    <xsl:apply-templates select="Impuestos"/>
  </xsl:template>

  <!-- InformacionGlobal -->
  <xsl:template match="InformacionGlobal">
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Periodicidad"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Meses"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Anio"/>
    </xsl:call-template>
  </xsl:template>

  <!-- CfdiRelacionados -->
  <xsl:template match="CfdiRelacionados">
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@TipoRelacion"/>
    </xsl:call-template>
    <xsl:for-each select="CfdiRelacionado">
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@UUID"/>
      </xsl:call-template>
    </xsl:for-each>
  </xsl:template>

  <!-- Emisor -->
  <xsl:template match="Emisor">
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Rfc"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Nombre"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@RegimenFiscal"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@FacAtrAdquirente"/>
    </xsl:call-template>
  </xsl:template>

  <!-- Receptor -->
  <xsl:template match="Receptor">
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Rfc"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Nombre"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@DomicilioFiscalReceptor"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@ResidenciaFiscal"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@NumRegIdTrib"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@RegimenFiscalReceptor"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@UsoCFDI"/>
    </xsl:call-template>
  </xsl:template>

  <!-- Conceptos -->
  <xsl:template match="Conceptos">
    <xsl:for-each select="Concepto">
      <xsl:apply-templates select="."/>
    </xsl:for-each>
  </xsl:template>

  <!-- Concepto -->
  <xsl:template match="Concepto">
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@ClaveProdServ"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@NoIdentificacion"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Cantidad"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@ClaveUnidad"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Unidad"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Descripcion"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@ValorUnitario"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Importe"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Descuento"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@ObjetoImp"/>
    </xsl:call-template>
    <!-- Impuestos del concepto -->
    <xsl:apply-templates select="Impuestos"/>
    <!-- ACuentaTerceros -->
    <xsl:apply-templates select="ACuentaTerceros"/>
    <!-- InformacionAduanera -->
    <xsl:for-each select="InformacionAduanera">
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@NumeroPedimento"/>
      </xsl:call-template>
    </xsl:for-each>
    <!-- CuentaPredial -->
    <xsl:for-each select="CuentaPredial">
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@Numero"/>
      </xsl:call-template>
    </xsl:for-each>
    <!-- Parte -->
    <xsl:for-each select="Parte">
      <xsl:apply-templates select="."/>
    </xsl:for-each>
  </xsl:template>

  <!-- ACuentaTerceros -->
  <xsl:template match="ACuentaTerceros">
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@RfcACuentaTerceros"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@NombreACuentaTerceros"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@RegimenFiscalACuentaTerceros"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@DomicilioFiscalACuentaTerceros"/>
    </xsl:call-template>
  </xsl:template>

  <!-- Parte -->
  <xsl:template match="Parte">
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@ClaveProdServ"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@NoIdentificacion"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Cantidad"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Unidad"/>
    </xsl:call-template>
    <xsl:call-template name="Requerido">
      <xsl:with-param name="valor" select="@Descripcion"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@ValorUnitario"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@Importe"/>
    </xsl:call-template>
    <xsl:for-each select="InformacionAduanera">
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@NumeroPedimento"/>
      </xsl:call-template>
    </xsl:for-each>
  </xsl:template>

  <!-- Impuestos (a nivel Comprobante y Concepto) -->
  <xsl:template match="Impuestos">
    <!-- Retenciones -->
    <xsl:for-each select="Retenciones/Retencion">
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@Base"/>
      </xsl:call-template>
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@Impuesto"/>
      </xsl:call-template>
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@TipoFactor"/>
      </xsl:call-template>
      <xsl:call-template name="Opcional">
        <xsl:with-param name="valor" select="@TasaOCuota"/>
      </xsl:call-template>
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@Importe"/>
      </xsl:call-template>
    </xsl:for-each>
    <!-- Traslados -->
    <xsl:for-each select="Traslados/Traslado">
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@Base"/>
      </xsl:call-template>
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@Impuesto"/>
      </xsl:call-template>
      <xsl:call-template name="Requerido">
        <xsl:with-param name="valor" select="@TipoFactor"/>
      </xsl:call-template>
      <xsl:call-template name="Opcional">
        <xsl:with-param name="valor" select="@TasaOCuota"/>
      </xsl:call-template>
      <xsl:call-template name="Opcional">
        <xsl:with-param name="valor" select="@Importe"/>
      </xsl:call-template>
    </xsl:for-each>
    <!-- TotalImpuestosRetenidos y TotalImpuestosTrasladados a nivel Comprobante -->
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@TotalImpuestosRetenidos"/>
    </xsl:call-template>
    <xsl:call-template name="Opcional">
      <xsl:with-param name="valor" select="@TotalImpuestosTrasladados"/>
    </xsl:call-template>
  </xsl:template>

  <!-- Template Requerido: siempre agrega el valor con pipe -->
  <xsl:template name="Requerido">
    <xsl:param name="valor"/>
    <xsl:value-of select="$valor"/>
    <xsl:text>|</xsl:text>
  </xsl:template>

  <!-- Template Opcional: solo agrega si el valor existe -->
  <xsl:template name="Opcional">
    <xsl:param name="valor"/>
    <xsl:if test="$valor">
      <xsl:value-of select="$valor"/>
      <xsl:text>|</xsl:text>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>
