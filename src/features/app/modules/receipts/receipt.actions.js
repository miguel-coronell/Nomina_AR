import { printHTML } from '../../../../services/print.service.js';
import { downloadLiquidacionPDF } from '../../../../services/pdf/index.js';
import { receiptHTML } from './receipt.view.js';

export const exportReceiptPDF = (rec, ctx) => downloadLiquidacionPDF(rec, ctx.state.settings.estudio, ctx.user.name, { patronales: ctx.state.settings.patronales });
export const printReceipt = (rec, ctx) => printHTML(receiptHTML(rec, ctx.state.settings.estudio, ctx.user.name, { patronales: ctx.state.settings.patronales }));
