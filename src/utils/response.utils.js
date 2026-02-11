// src/utils/response.utils.js

exports.success = (res, data = null, message = "Success", statusCode = 200) => {
    return res.status(statusCode).json({
        status: "success",
        statusCode,
        message,
        ...(data !== null && { data })
    });
};

exports.error = (res, message = "Internal Server Error", statusCode = 500, error = null) => {
    return res.status(statusCode).json({
        status: "error",
        statusCode,
        message,
        ...(error && { error })
    });
};
