/**
 * Input Validation Middleware for ShopOS
 * Provides schema-based validation, sanitization, and type coercion
 */

// Simple XSS sanitization - removes script tags and dangerous attributes
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
}

// Deep sanitize an object
function deepSanitize(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (Array.isArray(obj)) return obj.map(item => deepSanitize(item));
    if (typeof obj === 'object') {
        const sanitized = {};
        for (const key of Object.keys(obj)) {
            sanitized[key] = deepSanitize(obj[key]);
        }
        return sanitized;
    }
    return obj;
}

/**
 * Validation schemas for different endpoints
 */
const schemas = {
    // Inventory item schema
    inventoryItem: {
        part_number: { type: 'string', required: true, maxLength: 100 },
        name: { type: 'string', required: true, maxLength: 200 },
        tags: { type: 'string', maxLength: 500 },
        make: { type: 'string', maxLength: 100, default: 'Genuine' },
        aed_buying_price: { type: 'number', min: 0, max: 1000000 },
        ksh_buying_price: { type: 'number', min: 0, max: 10000000 },
        selling_price: { type: 'number', min: 0, max: 10000000 },
        stock_qty: { type: 'integer', min: 0, max: 100000 },
        min_stock: { type: 'integer', min: 0, max: 10000, default: 5 }
    },

    // Inventory update schema (all fields optional)
    inventoryUpdate: {
        part_number: { type: 'string', maxLength: 100 },
        name: { type: 'string', maxLength: 200 },
        tags: { type: 'string', maxLength: 500 },
        make: { type: 'string', maxLength: 100 },
        aed_buying_price: { type: 'number', min: 0, max: 1000000 },
        ksh_buying_price: { type: 'number', min: 0, max: 10000000 },
        selling_price: { type: 'number', min: 0, max: 10000000 },
        stock_qty: { type: 'integer', min: 0, max: 100000 },
        min_stock: { type: 'integer', min: 0, max: 10000 }
    },

    // Batch update schema
    batchUpdate: {
        updates: {
            type: 'array',
            required: true,
            minItems: 1,
            maxItems: 100,
            items: {
                uuid: { type: 'string', required: true },
                stock_qty: { type: 'integer', min: 0, max: 100000 },
                new_qty: { type: 'integer', min: 0, max: 100000 }
            }
        }
    },

    // Bulk import schema
    bulkImport: {
        items: {
            type: 'array',
            required: true,
            minItems: 1,
            maxItems: 5000,
            items: {
                part_number: { type: 'string', required: true, maxLength: 100 },
                name: { type: 'string', required: true, maxLength: 200 },
                tags: { type: 'string', maxLength: 500 },
                make: { type: 'string', maxLength: 100, default: 'Genuine' },
                aed_buying_price: { type: 'number', min: 0, max: 1000000 },
                ksh_buying_price: { type: 'number', min: 0, max: 10000000 },
                selling_price: { type: 'number', min: 0, max: 10000000 },
                stock_qty: { type: 'integer', min: 0, max: 100000 },
                min_stock: { type: 'integer', min: 0, max: 10000, default: 5 }
            }
        },
        update_existing: { type: 'boolean', default: true }
    },

    // Sale creation schema
    sale: {
        items: {
            type: 'array',
            required: true,
            minItems: 1,
            maxItems: 50,
            items: {
                uuid: { type: 'string', required: true },
                part_number: { type: 'string' },
                name: { type: 'string' },
                quantity: { type: 'integer', required: true, min: 1, max: 1000 },
                unit_price: { type: 'number', required: true, min: 0 },
                selling_price: { type: 'number', min: 0 }
            }
        },
        customer_name: { type: 'string', maxLength: 200 },
        notes: { type: 'string', maxLength: 1000 }
    },

    // Login schema
    login: {
        username: { type: 'string', required: true, maxLength: 50 },
        password: { type: 'string', required: true, minLength: 1, maxLength: 128 },
        device_info: { type: 'string', maxLength: 500 }
    },

    // Password change schema
    passwordChange: {
        current_password: { type: 'string', required: true },
        new_password: { type: 'string', required: true, minLength: 8, maxLength: 128 }
    },

    // User creation schema
    userCreate: {
        username: { type: 'string', required: true, minLength: 3, maxLength: 50, pattern: /^[a-zA-Z0-9_]+$/ },
        password: { type: 'string', required: true, minLength: 8, maxLength: 128 },
        full_name: { type: 'string', required: true, maxLength: 100 },
        role: { type: 'string', required: true, enum: ['admin', 'staff'] }
    },

    // Pagination params
    pagination: {
        page: { type: 'integer', min: 1, default: 1 },
        limit: { type: 'integer', min: 1, max: 100, default: 50 },
        search: { type: 'string', maxLength: 200 },
        sort_by: { type: 'string', maxLength: 50 },
        sort_order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
    },

    // Date range filter
    dateRange: {
        start_date: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ },
        end_date: { type: 'string', pattern: /^\d{4}-\d{2}-\d{2}$/ }
    }
};

/**
 * Validate a single field against its schema
 */
function validateField(value, fieldSchema, fieldName) {
    const errors = [];

    // Handle undefined/null
    if (value === undefined || value === null) {
        if (fieldSchema.required) {
            errors.push(`${fieldName} is required`);
        } else if (fieldSchema.default !== undefined) {
            return { value: fieldSchema.default, errors: [] };
        }
        return { value, errors };
    }

    // Type coercion and validation
    let coercedValue = value;
    switch (fieldSchema.type) {
        case 'string':
            coercedValue = String(value);
            if (fieldSchema.minLength && coercedValue.length < fieldSchema.minLength) {
                errors.push(`${fieldName} must be at least ${fieldSchema.minLength} characters`);
            }
            if (fieldSchema.maxLength && coercedValue.length > fieldSchema.maxLength) {
                errors.push(`${fieldName} must be at most ${fieldSchema.maxLength} characters`);
            }
            if (fieldSchema.pattern && !fieldSchema.pattern.test(coercedValue)) {
                errors.push(`${fieldName} format is invalid`);
            }
            if (fieldSchema.enum && !fieldSchema.enum.includes(coercedValue)) {
                errors.push(`${fieldName} must be one of: ${fieldSchema.enum.join(', ')}`);
            }
            break;

        case 'number':
            coercedValue = parseFloat(value);
            if (isNaN(coercedValue)) {
                errors.push(`${fieldName} must be a valid number`);
            } else {
                if (fieldSchema.min !== undefined && coercedValue < fieldSchema.min) {
                    errors.push(`${fieldName} must be at least ${fieldSchema.min}`);
                }
                if (fieldSchema.max !== undefined && coercedValue > fieldSchema.max) {
                    errors.push(`${fieldName} must be at most ${fieldSchema.max}`);
                }
            }
            break;

        case 'integer':
            coercedValue = parseInt(value, 10);
            if (isNaN(coercedValue)) {
                errors.push(`${fieldName} must be a valid integer`);
            } else {
                if (fieldSchema.min !== undefined && coercedValue < fieldSchema.min) {
                    errors.push(`${fieldName} must be at least ${fieldSchema.min}`);
                }
                if (fieldSchema.max !== undefined && coercedValue > fieldSchema.max) {
                    errors.push(`${fieldName} must be at most ${fieldSchema.max}`);
                }
            }
            break;

        case 'array':
            if (!Array.isArray(value)) {
                errors.push(`${fieldName} must be an array`);
            } else {
                if (fieldSchema.minItems && value.length < fieldSchema.minItems) {
                    errors.push(`${fieldName} must have at least ${fieldSchema.minItems} items`);
                }
                if (fieldSchema.maxItems && value.length > fieldSchema.maxItems) {
                    errors.push(`${fieldName} must have at most ${fieldSchema.maxItems} items`);
                }
                // Validate array items if schema provided
                if (fieldSchema.items) {
                    coercedValue = [];
                    for (let i = 0; i < value.length; i++) {
                        const itemResult = validateObject(value[i], fieldSchema.items);
                        if (itemResult.errors.length > 0) {
                            errors.push(...itemResult.errors.map(e => `${fieldName}[${i}].${e}`));
                        }
                        coercedValue.push(itemResult.data);
                    }
                }
            }
            break;
    }

    return { value: coercedValue, errors };
}

/**
 * Validate an object against a schema
 */
function validateObject(data, schema) {
    const errors = [];
    const validatedData = {};

    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
        const { value, errors: fieldErrors } = validateField(data[fieldName], fieldSchema, fieldName);
        errors.push(...fieldErrors);
        if (value !== undefined) {
            validatedData[fieldName] = value;
        }
    }

    return { data: validatedData, errors };
}

/**
 * Create validation middleware for a specific schema
 * @param {string} schemaName - Name of the schema to validate against
 * @param {string} source - Where to find data: 'body', 'query', or 'params'
 */
function validate(schemaName, source = 'body') {
    const schema = schemas[schemaName];
    if (!schema) {
        throw new Error(`Unknown validation schema: ${schemaName}`);
    }

    return (req, res, next) => {
        // Get data from the appropriate source
        let data;
        switch (source) {
            case 'body':
                data = req.body;
                break;
            case 'query':
                data = req.query;
                break;
            case 'params':
                data = req.params;
                break;
            default:
                data = req.body;
        }

        // Sanitize input first
        const sanitizedData = deepSanitize(data);

        // Validate against schema
        const { data: validatedData, errors } = validateObject(sanitizedData, schema);

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        // Replace request data with sanitized and validated data
        switch (source) {
            case 'body':
                req.body = { ...req.body, ...validatedData };
                break;
            case 'query':
                req.query = { ...req.query, ...validatedData };
                break;
            case 'params':
                req.params = { ...req.params, ...validatedData };
                break;
        }

        next();
    };
}

/**
 * Middleware to sanitize all request bodies
 */
function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = deepSanitize(req.body);
    }
    next();
}

/**
 * Password strength validator
 * Returns { valid: boolean, errors: string[] }
 */
function validatePasswordStrength(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (password.length > 128) {
        errors.push('Password must be at most 128 characters long');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    // Optional: require special character
    // if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    //     errors.push('Password must contain at least one special character');
    // }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    schemas,
    validate,
    sanitizeBody,
    sanitizeString,
    deepSanitize,
    validateObject,
    validatePasswordStrength
};
