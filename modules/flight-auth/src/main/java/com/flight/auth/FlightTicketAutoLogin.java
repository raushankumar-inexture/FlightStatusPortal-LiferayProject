package com.flight.auth;

import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.security.auto.login.AutoLogin;
import com.liferay.portal.kernel.security.auto.login.BaseAutoLogin;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.util.ParamUtil;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.osgi.service.component.annotations.Component;

/** Starts the real Liferay session when a request carries a good login ticket (?flightTicket=...). */
@Component(service = AutoLogin.class)
public class FlightTicketAutoLogin extends BaseAutoLogin {

	@Override
	protected String[] doLogin(HttpServletRequest request, HttpServletResponse response) throws Exception {
		String ticket = ParamUtil.getString(request, "flightTicket");

		if (ticket.isEmpty()) {
			return null;
		}

		long userId = Tickets.check(ticket);

		if (userId == 0) {
			return null;
		}

		User user = UserLocalServiceUtil.getUser(userId);

		if (!user.isActive()) {
			return null;
		}

		return new String[] {String.valueOf(userId), user.getPassword(), Boolean.TRUE.toString()};
	}

}
