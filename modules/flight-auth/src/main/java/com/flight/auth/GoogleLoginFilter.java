package com.flight.auth;

import com.liferay.portal.kernel.log.Log;
import com.liferay.portal.kernel.log.LogFactoryUtil;
import com.liferay.portal.kernel.model.User;
import com.liferay.portal.kernel.service.UserLocalServiceUtil;
import com.liferay.portal.kernel.util.PortalUtil;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.osgi.service.component.annotations.Component;

/**
 * A person who logs in with Google must also give the 6-digit code, the same as with a password.
 * Liferay marks a Google login session with OPEN_ID_CONNECT_SESSION_ID. This filter stops such a session on its next request
 * (before any page or API answers), sends the code, ends the session and sends the person to our login page, which shows the code box.
 * After the right code the normal login ticket gives a new session without that mark. Administrators skip the code, as with a password login.
 */
@Component(
	immediate = true,
	property = {
		"after-filter=Virtual Host Filter", "dispatcher=REQUEST", "servlet-context-name=",
		"servlet-filter-name=Flight Google Login Code Filter", "url-pattern=/*"
	},
	service = Filter.class
)
public class GoogleLoginFilter implements Filter {

	@Override
	public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
		throws IOException, jakarta.servlet.ServletException {

		HttpServletRequest request = (HttpServletRequest)servletRequest;
		HttpServletResponse response = (HttpServletResponse)servletResponse;

		try {
			HttpSession session = request.getSession(false);

			if ((session != null) && (session.getAttribute("OPEN_ID_CONNECT_SESSION_ID") != null) && !_isCallback(request)) {
				User user = _user(session);

				if ((user != null) && !_isAdmin(user)) {
					_stop(request, response, session, user);

					return;
				}
			}
		}
		catch (IllegalStateException illegalStateException) {
			// The session was just ended by someone else: nothing to check.
		}
		catch (Exception exception) {
			_log.error("Could not check the Google login", exception);
		}

		filterChain.doFilter(request, response);
	}

	/** The page Google sends people back to is where Liferay starts the session, so it must run first. */
	private static boolean _isCallback(HttpServletRequest request) {
		return request.getRequestURI().endsWith("/c/portal/login/openidconnect");
	}

	private static User _user(HttpSession session) throws Exception {
		Object userId = session.getAttribute("USER_ID");

		if (userId == null) {
			return null;
		}

		User user = UserLocalServiceUtil.fetchUser(Long.parseLong(String.valueOf(userId)));

		return ((user == null) || user.isGuestUser()) ? null : user;
	}

	private static boolean _isAdmin(User user) throws Exception {
		return UserLocalServiceUtil.hasRoleUser(PortalUtil.getDefaultCompanyId(), "Administrator", user.getUserId(), true);
	}

	private void _stop(HttpServletRequest request, HttpServletResponse response, HttpSession session, User user) throws Exception {
		String id = AuthApplication.startChallenge(user);

		session.invalidate();

		_log.info("Google login for " + user.getEmailAddress() + " needs the code before access");

		String uri = request.getRequestURI();
		String[] parts = uri.split("/");

		// Pages look like /web/<site>/<page>: the login page of the same site shows the code box.
		if ((parts.length > 3) && ("web".equals(parts[1]) || "group".equals(parts[1]))) {
			response.sendRedirect("/" + parts[1] + "/" + parts[2] + "/login?otp=" + id);

			return;
		}

		if (uri.startsWith("/o/") || uri.startsWith("/api/")) {
			response.setStatus(401);
			response.setContentType("application/json");
			response.getOutputStream().write("{\"error\":\"Enter your login code first.\"}".getBytes(StandardCharsets.UTF_8));

			return;
		}

		response.sendRedirect("/?otp=" + id);
	}

	private static final Log _log = LogFactoryUtil.getLog(GoogleLoginFilter.class);

}
