var express = require('express');
var app = express();
var mysql = require('mysql');
var fs = require('fs');



var pool = mysql.createPool({
	host: 'localhost',
	user: 'mlzh',
	password: 'mlzh486915',
	port: '3306',
	database: 'ml',
	// 最大连接数，默认为10
	connectionLimit: 5,
})

//查询注册码状态
/*
code值:
0 : 注册码可正常使用
1 : 注册码不存在
2 : 注册码已过期
3 : 绑定设备已超过限制
999 : 参数等异常错误
*/
app.get('/checkCode', function(req, res) {

	res.setHeader('Content-Type', 'text/html; charset=utf8');
	var code = 999; //状态码
	var detail = "服务器内部错误";
	var response;

	console.log(req.query.code);
	var key = req.query.code;
	var deviceID = req.query.deviceID;
	if (key === "" || key === undefined) {

		response = {
			code: code,
			detail: "参数错误"
		};
		res.end(JSON.stringify(response));
		return
	}
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log(err);
			code = 999;
			detail = "database connection error";
		} else {
			var sql = "SELECT * from User where UserID = '" + key.toString() + "'"
			console.log(sql);
			connection.query(sql, function(err, result) {

				if (err) {
					console.log(err);
					code = 999;
					detail = "database query error";
				} else {
					console.log('The result is: ', result);

					if (result.length > 0) {

						if (result[0].StartTime == 0) {
							var startTimestamp, endTimestamp;
							//注册码第一次登录,获取当前时间,并更新数据库
							console.log("第一次登录,更新起止时间");
							startTimestamp = new Date().getTime(); //获取当前时间戳,北京时间差12小时...
							console.log("当前时间: ", Date());
							console.log(startTimestamp)
							var modSql = "";
							var modSqlParams = "";
							var type = result[0].Type //获取注册码类型默认为1表示周卡

							//0:天卡, 1:周卡, 2:月卡, 3:季卡, 4:半年卡, 5:年卡, 6: 十年卡
							switch (type) {
								case 0:
									//天卡
									endTimestamp = startTimestamp + 1 * 60 * 60 * 24 * 1000 //加1天
									break;
								case 1:
									//周卡
									endTimestamp = startTimestamp + 7 * 60 * 60 * 24 * 1000 //加7天
									break;
								case 2:
									//月卡
									endTimestamp = startTimestamp + 30 * 60 * 60 * 24 * 1000 //加30天
									break;
								case 3:
									//季卡
									endTimestamp = startTimestamp + 90 * 60 * 60 * 24 * 1000 //加90天
									break;
								case 4:
									//半年卡
									endTimestamp = startTimestamp + 180 * 60 * 60 * 24 * 1000 //加180天
									break;
								case 5:
									//年卡
									endTimestamp = startTimestamp + 360 * 60 * 60 * 24 * 1000 //加360天
									break;
								case 6:
									//十年卡
									endTimestamp = startTimestamp + 360 * 60 * 60 * 24 * 1000 * 10 //加360天 * 10
									break;
								default:
									detail = "不支持的点卡类型~"
									endTimestamp = startTimestamp + 1
							}

							//判断新接口是否传入了设备ID
							if (deviceID === "" || deviceID === undefined) {
								//没有传设备ID,只更新时间即可
								modSql = 'UPDATE User SET StartTime = ?, EndTime = ? WHERE UserID = ?';
								modSqlParams = [startTimestamp, endTimestamp, key.toString()];
							}else{
								//带入了设备ID,注册码首次使用,直接绑定
								modSql = 'UPDATE User SET StartTime = ?, EndTime = ? ,DeviceList = ? WHERE UserID = ?';
								modSqlParams = [startTimestamp, endTimestamp, deviceID, key.toString()];
							}
							console.log('更新数据库时间参数:',modSqlParams)
							//更新数据库
							connection.query(modSql, modSqlParams, function(err, result) {
								if (err) {
									console.log(err);
									code = 999;
									detail = "database update error";
								} else {
									code = 0
									detail = "成功"
									console.log('UPDATE affectedRows', result.affectedRows);
								}
								response = {
									code: code,
									detail: detail,
									startTime: timetrans(startTimestamp),
									endTime: timetrans(endTimestamp)
								};
								connection.release();
								res.end(JSON.stringify(response));
							});

						} else {
							console.log("登录过,判断是否过期");
							var currentTime = new Date().getTime(); //获取当前时间戳,北京时间差12小时...
							var regType = result[0].CodeType;	//获取注册码多开类型
							var deviceList = result[0].DeviceList;	//获取当前已绑定的列表
							var newListStr = "";
							var needUpdate = false;
							console.log("result:",result);
							console.log("已绑定列表:",deviceList);
							console.log("regType:",regType);
							console.log("开始时间:",timetrans(result[0].StartTime));
							console.log("结束时间:",timetrans(result[0].EndTime));
							if (currentTime < result[0].EndTime) {
								//没过期,判断设备绑定情况
								var arr = deviceList.split(",");
								console.log("length:",arr.length);
								if (regType == 1 && arr.length == 1) {
									//单开注册码,判断是否相等
									if (deviceID == "" || deviceID == undefined) {
										//校验注册码成功,兼容老版本
										code = 0;
										detail = "成功";
									}else{
										if (arr[0] == "0") {
											//首次使用,需要更新数据库
											newListStr = deviceID
											needUpdate = true;
										}else{
											if (arr[0] == deviceID) {
												code = 0;
												detail = "成功";
											}else{
												code = 3;
												detail = "已超过绑定设备个数";
											}
											
										}
									}
								}else {
									//判断多开注册码
									
									if (arr.length < regType) {
										var isExist = false;
										for (var i = 0; i < arr.length; i++) {
											if (arr[i] == deviceID) {
												isExist = true;
												break;
											} 
										}
										if (isExist == false) {
											//新设备,加入绑定
											arr.push(deviceID);
											console.log("push后的数组:",arr);
											newListStr = ""
											for (var i = 0; i < arr.length; i++) {
												if (i == arr.length - 1) {
													//最后一个不需要加分隔符
													newListStr = newListStr + arr[i]
												}else{
													newListStr = newListStr + arr[i] + ","
												}
											}
											console.log("拼接后的字符串:",newListStr);
											needUpdate = true;
										}else{
											//已绑定中存在传入的,返回成功
											code = 0;
											detail = "成功";
										}
										
									}else{
										//注册码已经达到多开限制,判断是不是属于里面的
										var isExist = false;
										for (var i = 0; i < arr.length; i++) {
											if (arr[i] == deviceID) {
												isExist = true;
												break;
											} 
										}
										if (isExist == false) {
											//新设备,超过绑定限制
											code = 3;
											detail = "已超过绑定设备个数";
										}else{
											//已绑定中存在传入的,返回成功
											code = 0;
											detail = "成功";
										}
									}

								}

							} else {
								//已过期
								code = 2;
								detail = "注册码已过期";
							}

							if (needUpdate == true) {
								//需要更新数据库后返回


								var	modSql = 'UPDATE User SET DeviceList = ? WHERE UserID = ?';
								var	modSqlParams = [newListStr, key.toString()];
							
							
								//更新数据库
								connection.query(modSql, modSqlParams, function(err, updateResult) {
									if (err) {
										console.log(err);
										code = 999;
										detail = "database update error";
									} else {
										code = 0
										detail = "成功"
										console.log('UPDATE affectedRows', updateResult.affectedRows);
									}
									response = {
										code: code,
										detail: detail,
										startTime: timetrans(result[0].StartTime),
										endTime: timetrans(result[0].EndTime)
									};
									connection.release();
									res.end(JSON.stringify(response));
								});

							}else{
								response = {
								code: code,
								detail: detail,
								startTime: timetrans(result[0].StartTime),
								endTime: timetrans(result[0].EndTime)
								};
								connection.release();
								res.end(JSON.stringify(response));
							}
							
						}

					} else {
						code = 1
						detail = "注册码不存在~请联系管理员"
						response = {
							code: code,
							detail: detail
						};
						connection.release();
						res.end(JSON.stringify(response));
					}
				}


			})
		}

	})

})

//给所有注册码新增时间
/*
参数: hour
*/
app.get('/addTimeAll',function(req, res)) {
	res.setHeader('Content-Type', 'text/html; charset=utf8');
	var code = 999; //状态码
	var detail = "服务器内部错误";
	var response;
	console.log("增加时间传参:" + req.query.hour);
	var key = req.query.hour;
	if (key === "" || key === undefined) {
	
		response = {
			code: code,
			detail: "参数错误"
		};
		res.end(JSON.stringify(response));
		return
	}
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log(err);
			code = 999;
			detail = "database connection error";
		} else {
			connection.query('SELECT * FROM `User` WHERE `EndTime` != 0', function(err, result) {
	
				if (err) {
					console.log(err);
					code = 999;
					detail = "database query error";
				} else {
					detail = "添加失败的记录:"
					var sql = 'UPDATE User SET EndTime = ? WHERE UserID = ?';
					result.forEach((item, index)=>{
						let newEndTime = item.EndTime + key * 3600 * 1000
						var modSqlParams = [newEndTime, item.UserID];
					    connection.query(sql, modSqlParams, function(err, result) {
					        if (err) { 
					            console.log('UPDATE ERROR - ', err.message);
					            detail = detail + item.UserID + ","
					        }
					    })
					})
					code = 0;
					
				}
	
				response = {
					code: code,
					detail: detail
				};
				connection.release();
				res.end(JSON.stringify(response));
			})
		}
	
	})
	
	
}

//查询当前服务器版本号
app.get('/getVersion', function(req, res) {

	res.setHeader('Content-Type', 'text/html; charset=utf8');
	var code = 999;
	var version = -1;
	var detail = "";
	var url;
	var response;
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log(err);
			code = 999;
			version = -1;
			detail = "database connection error";
		} else {
			connection.query('SELECT * from Version', function(err, result) {

				if (err) {
					console.log(err);
					code = 999;
					version = -1;
					detail = "database query error";
				} else {
					console.log('The result is: ', result[0]);
					code = 0;
					version = result[0].ver;
					detail = result[0].detail;
					url = result[0].url
				}

				response = {
					code: code,
					version: version,
					detail: detail,
					url: url
				};
				connection.release();
				res.end(JSON.stringify(response));
			})
		}

	})

})


//下载最新版本的安装包(废弃)
app.get('/downloadApk', function(req, res) {

	var path = '/www/wwwroot/mlzh/updateApk/泰迪魔灵脚本.apk'; // 文件存储的路径
	res.download(path,'泰迪新版本.apk');
})

//检查服务器是否正常开启
app.get('/', function(req, res) {
	res.write('service start success')
	res.end()
})

var server = app.listen(4869, function() {
	console.log('Server running at http://IP:4869/');
})

//根据订单编号生成注册码
app.get('/createCode', function(req, res) {

	res.setHeader('Content-Type', 'text/html; charset=utf8');
	var code = 999; //状态码
	var detail = "服务器内部错误";
	var response;

	console.log(req.query.orderID);
	var orderID = req.query.orderID;
	var orderType = req.query.orderType;
	var regType = req.query.regType;
	
	if (orderID === "" || orderID === undefined || orderType === "" || orderType === undefined || regType === "" || regType === undefined) {

		response = {
			code: code,
			detail: "参数错误"
		};
		res.end(JSON.stringify(response));
		return
	}
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log(err);
			code = 999;
			detail = "database connection error";
		} else {
			var userID = uuidv4();
			var addSql = 'INSERT IGNORE INTO User(UserID,StartTime,EndTime,Type,CodeType,DeviceList,OrderID) VALUES(?,?,?,?,?,?,?)';
			var addSqlParams = [userID, 0, 0, orderType, regType, 0, orderID];
			connection.query(addSql, addSqlParams, function(err, result) {

				if (err) {
					console.log(err);
					code = 999;
					detail = "database insert error";
					response = {
						code: code,
						detail: detail
					};
				} else {
					console.log('The result is: ', result);
					code = 0;
					if (result.affectedRows > 0) {

						detail = "插入订单编码：" + orderID.toString() + "，" + "类型：" + orderType + "成功";
						response = {
							code: code,
							detail: detail,
							userID: userID
						};
					} else {
						detail = "插入异常"
						response = {
							code: code,
							detail: detail
						};
					}


				}


				connection.release();
				res.end(JSON.stringify(response));
			})
		}

	})
})


//批量生成注册码
app.get('/createDelegateCode', function(req, res) {

	res.setHeader('Content-Type', 'text/html; charset=utf8');
	var code = 999; //状态码
	var detail = "服务器内部错误";
	var response;

	var orderID = req.query.orderID;
	var orderType = req.query.orderType;
	var number = req.query.number;
	var regType = req.query.regType;
	
	if (number === "" || number === undefined || orderType === "" || orderType === undefined || orderID === "" || orderID === undefined || regType === "" || regType === undefined ) {

		response = {
			code: code,
			detail: "参数错误"
		};
		res.end(JSON.stringify(response));
		return
	}
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log(err);
			code = 999;
			detail = "database connection error";
		} else {
			
			var uuidArr = new Array();
			var dataArr = new Array();
			for (var i = 0; i < number; i++) {
				var userID = uuidv4();
				var subArr = [userID,0,0,orderType,regType,0,orderID];

				dataArr[i] = subArr;
				uuidArr[i] = userID;
			}
			
			var addSql = "INSERT IGNORE INTO User(UserID,StartTime,EndTime,Type,CodeType,DeviceList,OrderID) VALUES ?";
			// var addSqlParams = [userID, 0, 0, orderType, orderID];
			connection.query(addSql, [dataArr], function(err, result) {

				if (err) {
					console.log(err);
					code = 999;
					detail = "database insert error";
					response = {
						code: code,
						detail: detail
					};
				} else {
					console.log('The result is: ', result);
					code = 0;
					if (result.affectedRows > 0) {

						detail = "批量生成注册码类型：" + orderType + "成功";
						response = {
							code: code,
							detail: detail,
							userID: uuidArr
						};
					} else {
						detail = "插入异常~"
						response = {
							code: code,
							detail: detail
						};
					}


				}


				connection.release();
				res.end(JSON.stringify(response));
			})
		}

	})
})


//解绑设备
/*
code值:
0 : 注册码可正常使用
1 : 注册码不存在
2 : 注册码已过期
3 : 注册码未绑定该设备,请在已绑定的设备进行解绑~
999 : 参数等异常错误
*/
app.get('/unbindDevice', function(req, res) {

	res.setHeader('Content-Type', 'text/html; charset=utf8');
	var code = 999; //状态码
	var detail = "服务器内部错误";
	var response;

	var key = req.query.regCode;
	var deviceID = req.query.deviceID;
	if (key === "" || key === undefined || deviceID === "" || deviceID === undefined) {

		response = {
			code: code,
			detail: "参数错误"
		};
		res.end(JSON.stringify(response));
		return
	}
	pool.getConnection(function(err, connection) {
		if (err) {
			console.log(err);
			code = 999;
			detail = "database connection error";
		} else {
			var sql = "SELECT * from User where UserID = '" + key.toString() + "'"
			console.log(sql);
			connection.query(sql, function(err, result) {

				if (err) {
					console.log(err);
					code = 999;
					detail = "database query error";
				} else {
					console.log('The result is: ', result);

					if (result.length > 0) {

						if (result[0].StartTime == 0) {
							var startTimestamp, endTimestamp;
							//注册码第一次登录,获取当前时间,并更新数据库
							console.log("第一次登录,更新起止时间");
							startTimestamp = new Date().getTime(); //获取当前时间戳,北京时间差12小时...
							console.log("当前时间: ", Date());
							console.log(startTimestamp)
							var modSql = "";
							var modSqlParams = "";
							var type = result[0].Type //获取注册码类型默认为1表示周卡

							//0:天卡, 1:周卡, 2:月卡, 3:季卡, 4:半年卡, 5:年卡
							switch (type) {
								case 0:
									//天卡
									endTimestamp = startTimestamp + 1 * 60 * 60 * 24 * 1000 //加1天
									break;
								case 1:
									//周卡
									endTimestamp = startTimestamp + 7 * 60 * 60 * 24 * 1000 //加7天
									break;
								case 2:
									//月卡
									endTimestamp = startTimestamp + 30 * 60 * 60 * 24 * 1000 //加30天
									break;
								case 3:
									//季卡
									endTimestamp = startTimestamp + 90 * 60 * 60 * 24 * 1000 //加90天
									break;
								case 4:
									//半年卡
									endTimestamp = startTimestamp + 180 * 60 * 60 * 24 * 1000 //加180天
									break;
								case 5:
									//年卡
									endTimestamp = startTimestamp + 360 * 60 * 60 * 24 * 1000 //加360天
									break;
								default:
									detail = "不支持的点卡类型~"
									endTimestamp = startTimestamp + 1
							}

							//带入了设备ID,注册码首次使用,直接清空绑定的设备列表
								modSql = 'UPDATE User SET StartTime = ?, EndTime = ? ,DeviceList = ? WHERE UserID = ?';
								modSqlParams = [startTimestamp, endTimestamp, "0", key.toString()];
							
							//更新数据库
							connection.query(modSql, modSqlParams, function(err, result) {
								if (err) {
									console.log(err);
									code = 999;
									detail = "database update error";
								} else {
									code = 0
									detail = "成功"
									console.log('UPDATE affectedRows', result.affectedRows);
								}
								response = {
									code: code,
									detail: detail,
									startTime: timetrans(startTimestamp),
									endTime: timetrans(endTimestamp)
								};
								connection.release();
								res.end(JSON.stringify(response));
							});

						} else {
							console.log("登录过,判断是否过期");
							var currentTime = new Date().getTime(); //获取当前时间戳,北京时间差12小时...
							var regType = result[0].CodeType;	//获取注册码多开类型
							var deviceList = result[0].DeviceList;	//获取当前已绑定的列表
							var newListStr = "";
							var needUpdate = false;
							console.log("已绑定列表:",deviceList);
							console.log("regType:",regType);
							console.log("开始时间:",timetrans(result[0].StartTime));
							console.log("结束时间:",timetrans(result[0].EndTime));
							if (currentTime < result[0].EndTime) {
								//没过期,判断设备绑定情况
								var arr = deviceList.split(",");
								console.log("length:",arr.length);
								if (regType == 1 && arr.length == 1) {
									//单开注册码,判断是否相等
									
									if (arr[0] == "0") {
										//注册码未绑定任何设备,直接返回成功
										code = 0;
										detail = "成功";
									}else{
										if (arr[0] == deviceID) {
											newListStr = "0";
											needUpdate = true;
										}else{
											code = 3;
											detail = "该注册码未绑定此设备,请在已绑定的设备进行解绑~";
										}		
									}
									
								}else {
									//判断多开注册码
									if (arr[0] == "0") {
										//注册码未绑定任何设备,直接返回成功
										code = 0;
										detail = "成功";
									}else{
										var isExist = false;
										var newArr = new Array();
										for (var i = 0; i < arr.length; i++) {
											if (arr[i] == deviceID) {
												isExist = true;
												break;
											}else{
												newArr.push(arr[i]);
											}
										}	
										if (isExist == true) {
											newListStr = ""
											for (var i = 0; i < newArr.length; i++) {
												if (i == newArr.length - 1) {
													//最后一个不需要加分隔符
													newListStr = newListStr + newArr[i]
												}else{
													newListStr = newListStr + newArr[i] + ","
												}
											}
											if (newArr.length == 0) {
												newListStr = "0"
											}
											console.log("拼接后的字符串:",newListStr);
											needUpdate = true;
										}else{
											code = 3;
											detail = "该注册码未绑定此设备,请在已绑定的设备进行解绑~";
										}
									}

								}

							} else {
								//已过期
								code = 2;
								detail = "注册码已过期";
							}

							if (needUpdate == true) {
								//需要更新数据库后返回


								var	modSql = 'UPDATE User SET DeviceList = ? WHERE UserID = ?';
								var	modSqlParams = [newListStr, key.toString()];
							
							
								//更新数据库
								connection.query(modSql, modSqlParams, function(err, updateResult) {
									if (err) {
										console.log(err);
										code = 999;
										detail = "database update error";
									} else {
										code = 0
										detail = "成功"
										console.log('UPDATE affectedRows', updateResult.affectedRows);
									}
									response = {
										code: code,
										detail: detail,
										startTime: timetrans(result[0].StartTime),
										endTime: timetrans(result[0].EndTime)
									};
									connection.release();
									res.end(JSON.stringify(response));
								});

							}else{
								response = {
								code: code,
								detail: detail,
								startTime: timetrans(result[0].StartTime),
								endTime: timetrans(result[0].EndTime)
								};
								connection.release();
								res.end(JSON.stringify(response));
							}
							
						}

					} else {
						code = 1
						detail = "注册码不存在~请联系管理员"
						response = {
							code: code,
							detail: detail
						};
						connection.release();
						res.end(JSON.stringify(response));
					}
				}


			})
		}

	})

})

//时间戳转字符串
function timetrans(date) {
	var chinaTime = date; //北京时间需要加12小时
	var date = new Date(chinaTime); //如果date为13位不需要乘1000
	var Y = date.getFullYear() + '-';
	var M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-';
	var D = (date.getDate() < 10 ? '0' + (date.getDate()) : date.getDate()) + ' ';
	var h = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':';
	var m = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ':';
	var s = (date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds());
	return Y + M + D + h + m + s;
}

//生成一个uuid
function uuidv4() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0,
			v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}
