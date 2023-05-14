"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentService = exports.createNewOrder = void 0;
const response_handler_1 = __importDefault(require("../utils/response-handler"));
const constants_1 = require("../constants");
const utils_1 = __importDefault(require("../utils"));
const user_service_1 = __importDefault(require("../services/user.service"));
const paystack_1 = require("../integrations/paystack");
const product_service_1 = __importDefault(require("../services/product.service"));
const order_service_1 = __importDefault(require("../services/order.service"));
const createNewOrder = async (data) => {
    try {
        const { first_name, last_name, phone_number, user_id, additional_phone_number, additional_info, city, address, total_price, products } = data;
        const orderProducts = [];
        for (const product of products) {
            const { product_id, product_name, quantity } = product;
            const orderProduct = { product_id, product_name, quantity };
            orderProducts.push(orderProduct);
            await product_service_1.default.atomicUpdate(product_id, { $inc: { quantity: -quantity } });
        }
        const order = await order_service_1.default.createOrder({
            user_id,
            first_name,
            last_name,
            phone_number,
            additional_phone_number,
            additional_info,
            city,
            address,
            products: orderProducts,
            total_price,
        });
        return {
            success: true,
            message: 'Order created successfully',
            data: order,
        };
    }
    catch (error) {
        console.log(error);
    }
};
exports.createNewOrder = createNewOrder;
const createPaymentService = async (req, res) => {
    try {
        const user = utils_1.default.throwIfUndefined(req.user, 'req.user');
        const { first_name, last_name, phone_number, additional_phone_number, additional_info, city, address, total_price, products } = req.body;
        const getUser = await user_service_1.default.getById({ _id: user._id });
        if (!getUser) {
            return response_handler_1.default.sendErrorResponse({ res, code: 404, error: 'User does not exist' });
        }
        const reference = utils_1.default.generateTXRef();
        const transaction_hash = utils_1.default.generateTXHash();
        const payload = {
            email: user?.email,
            amount: total_price * 100,
            callback_url: 'https://documenter.getpostman.com/view/11498186/2s93ecwqYn',
            metadata: {
                first_name,
                last_name,
                phone_number,
                additional_phone_number,
                additional_info,
                products,
                city,
                address,
                total_price,
                user_id: user._id,
                payment_reference: reference,
                transaction_hash,
            },
            customerName: `${user?.first_name} ${user?.last_name}`,
        };
        const [apiCall] = await Promise.all([await paystack_1.paystackAPI.initializeTransaction(payload)]);
        const data = {
            url: apiCall.data.authorization_url,
            access_code: apiCall.data.access_code,
            reference: apiCall.data.reference,
        };
        return response_handler_1.default.sendSuccessResponse({
            res,
            code: constants_1.HTTP_CODES.OK,
            message: 'Paystack payment url generated successfully',
            data: data,
        });
    }
    catch (error) {
        response_handler_1.default.sendErrorResponse({
            code: constants_1.HTTP_CODES.INTERNAL_SERVER_ERROR,
            error: `${error}`,
            res,
        });
    }
};
exports.createPaymentService = createPaymentService;
